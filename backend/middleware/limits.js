// Request limits: they stop one caller (a bug, a script, an attacker) from using up the server,
// the database or the YouTube quota for everyone else.
//
// Principles:
//   * Limits are far above real use. A sensor sends 6 samples a minute and the dashboard makes
//     roughly 10 to 40 requests a minute, so ordinary use never comes near them.
//   * Whoever is signed in is limited AS THAT PERSON (or device), not by network address, so
//     several people behind one school or office connection don't use up each other's limit.
//   * Network addresses are used only where nobody is signed in yet (login, pairing, failed keys).
//     They are generous and fail safe: if the address can't be told apart (all callers look like
//     one), the limit is still far above what a handful of real users produce.
//   * Counting failures separately (wrong code, wrong key) makes guessing slow without slowing
//     down people who get it right the first time.
//   * Going over a limit gives HTTP 429 with a Retry-After header; the sensor and the dashboard
//     treat that as "try again soon", never as "you were removed".
//
// The counters live in this server's memory, which is right for a single server: they reset when
// it restarts, and nothing else needs to share them. Set RATE_LIMIT_DISABLED=true to switch every
// limit off (for example if one ever misfires in production).

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const authMiddleware = require("./authMiddleware");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const DEFAULTS = {
  ingest: { windowMs: MINUTE, limit: 30 }, //          samples, per device
  dashboard: { windowMs: MINUTE, limit: 300 }, //      dashboard requests, per person
  destructive: { windowMs: HOUR, limit: 10 }, //       deleting data or an account, per person
  login: { windowMs: MINUTE, limit: 60 }, //           Google sign-ins, per address
  loginFails: { windowMs: MINUTE, limit: 20 }, //      rejected sign-ins, per address
  pair: { windowMs: MINUTE, limit: 30 }, //            pairing attempts, per address
  pairFails: { windowMs: MINUTE, limit: 10 }, //       wrong or expired codes, per address
  authFails: { windowMs: MINUTE, limit: 30 }, //       wrong device keys / tokens on ingest, per address
  diagnostic: { windowMs: MINUTE, limit: 20 }, //      the network check, per address
};

const byAddress = (req) => `ip:${ipKeyGenerator(req.ip || "unknown")}`;
const byPerson = (req) => (req.user?.id ? `user:${req.user.id}` : byAddress(req));
const byDevice = (req) =>
  req.device?.id ? `device:${req.device.id}` : byPerson(req);

const failedWith = (...codes) => (req, res) => !codes.includes(res.statusCode);

const tooMany = (what) => (req, res, next, options) => {
  const resetMs = req.rateLimit?.resetTime
    ? req.rateLimit.resetTime.getTime() - Date.now()
    : options.windowMs;
  const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
  res.status(options.statusCode).json({
    error: `Too many ${what}. Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} and try again.`,
    retry_after: retryAfter,
  });
};

const make = (what, config, extra = {}) =>
  rateLimit({
    ...config,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooMany(what),
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
    ...extra,
  });

// `overrides` replaces numbers per limit, e.g. createLimiters({ ingest: { limit: 3 } }); the
// tests use it to hit a limit quickly.
const createLimiters = (overrides = {}) => {
  const cfg = (name) => ({ ...DEFAULTS[name], ...(overrides[name] || {}) });

  const limits = {
    ingest: make("samples", cfg("ingest"), { keyGenerator: byDevice }),
    dashboard: make("requests", cfg("dashboard"), { keyGenerator: byPerson }),
    destructive: make("delete requests", cfg("destructive"), { keyGenerator: byPerson }),
    login: make("sign-in attempts", cfg("login"), { keyGenerator: byAddress }),
    loginFails: make("failed sign-ins", cfg("loginFails"), {
      keyGenerator: byAddress,
      skipSuccessfulRequests: true,
      requestWasSuccessful: failedWith(401),
    }),
    pair: make("pairing attempts", cfg("pair"), { keyGenerator: byAddress }),
    pairFails: make("wrong pairing codes", cfg("pairFails"), {
      keyGenerator: byAddress,
      skipSuccessfulRequests: true,
      requestWasSuccessful: (req, res) => res.statusCode < 400,
    }),
    authFails: make("requests with a wrong key", cfg("authFails"), {
      keyGenerator: byAddress,
      skipSuccessfulRequests: true,
      requestWasSuccessful: failedWith(401, 403),
    }),
    diagnostic: make("requests", cfg("diagnostic"), { keyGenerator: byAddress }),
  };

  // Routes for a signed-in person: check the login first, so the limit counts that person.
  limits.authed = [authMiddleware, limits.dashboard];
  limits.authedDestructive = [authMiddleware, limits.destructive];
  return limits;
};

// How many proxies sit between the internet and this server. Render puts at least one there, and
// the right number decides which address Express reports. TRUST_PROXY_HOPS overrides it; see
// GET /api/network-check for how to check it against the real host.
const trustProxyHops = (value = process.env.TRUST_PROXY_HOPS) => {
  if (value === undefined || value === "") return 1;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
};

module.exports = Object.assign(createLimiters(), { createLimiters, trustProxyHops, DEFAULTS });

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const authMiddleware = require("./authMiddleware");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const DEFAULTS = {
  ingest: { windowMs: MINUTE, limit: 30 }, //          samples, per device
  dashboard: { windowMs: MINUTE, limit: 300 }, //      dashboard requests, per person
  destructive: { windowMs: HOUR, limit: 10 }, //       deleting data or an account, per person
  exportData: { windowMs: HOUR, limit: 6 }, //         downloading all one's data (a big read), per person
  login: { windowMs: MINUTE, limit: 60 }, //           Google sign-ins, per address
  loginFails: { windowMs: MINUTE, limit: 20 }, //      rejected sign-ins, per address
  pair: { windowMs: MINUTE, limit: 30 }, //            pairing attempts, per address
  pairFails: { windowMs: MINUTE, limit: 10 }, //       wrong or expired codes, per address
  authFails: { windowMs: MINUTE, limit: 30 }, //       wrong device keys / tokens on ingest, per address
  diagnostic: { windowMs: MINUTE, limit: 20 }, //      the network check, per address
};

const byAddress = (req) => `ip:${ipKeyGenerator(req.ip || "unknown")}`;
const byPerson = (req) =>
  req.user?.id ? `user:${req.user.id}` : byAddress(req);
const byDevice = (req) =>
  req.device?.id ? `device:${req.device.id}` : byPerson(req);

const failedWith =
  (...codes) =>
  (req, res) =>
    !codes.includes(res.statusCode);

const waitPhrase = (seconds) => {
  if (seconds >= 120) return `about ${Math.ceil(seconds / 60)} minutes`;
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
};

const tooMany = (what) => (req, res, next, options) => {
  const resetMs = req.rateLimit?.resetTime
    ? req.rateLimit.resetTime.getTime() - Date.now()
    : options.windowMs;
  const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
  res.status(options.statusCode).json({
    error: `Too many ${what}. Please wait ${waitPhrase(retryAfter)} and try again.`,
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

const createLimiters = (overrides = {}) => {
  const cfg = (name) => ({ ...DEFAULTS[name], ...(overrides[name] || {}) });

  const limits = {
    ingest: make("samples", cfg("ingest"), { keyGenerator: byDevice }),
    dashboard: make("requests", cfg("dashboard"), { keyGenerator: byPerson }),
    destructive: make("delete requests", cfg("destructive"), {
      keyGenerator: byPerson,
    }),
    exportData: make("data downloads", cfg("exportData"), {
      keyGenerator: byPerson,
    }),
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
    diagnostic: make("requests", cfg("diagnostic"), {
      keyGenerator: byAddress,
    }),
  };

  limits.authed = [authMiddleware, limits.dashboard];
  limits.authedDestructive = [authMiddleware, limits.destructive];
  limits.authedExport = [authMiddleware, limits.exportData];
  return limits;
};

const DEFAULT_PROXY_HOPS = 3;
const trustProxyHops = (value = process.env.TRUST_PROXY_HOPS) => {
  if (value === undefined || value === "") return DEFAULT_PROXY_HOPS;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_PROXY_HOPS;
};

module.exports = Object.assign(createLimiters(), {
  createLimiters,
  trustProxyHops,
  DEFAULTS,
});

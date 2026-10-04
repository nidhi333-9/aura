const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "unit-test-secret";

const { createLimiters, trustProxyHops, DEFAULTS } = require("../middleware/limits");

const token = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

// A throwaway server with the limiter under test in front of a handler that answers with the
// status the caller asks for (header x-status), so each test can decide success or failure.
const serve = async (build, { trustProxy = 1 } = {}) => {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(express.json());
  build(app);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close() };
};
const answer = (req, res) => res.status(Number(req.headers["x-status"] || 200)).json({ ok: true });

const hit = (base, path, headers = {}, method = "GET") => fetch(base + path, { method, headers });
const statuses = async (n, base, path, headers) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push((await hit(base, path, headers)).status);
  return out;
};

test("every default limit is far above ordinary use", () => {
  // A sensor sends 6 samples a minute; the dashboard makes roughly 10 to 40 requests a minute.
  assert.ok(DEFAULTS.ingest.limit / (DEFAULTS.ingest.windowMs / 60000) >= 5 * 6, "ingest: at least 5x a sensor");
  assert.ok(DEFAULTS.dashboard.limit / (DEFAULTS.dashboard.windowMs / 60000) >= 5 * 40, "dashboard: at least 5x a busy dashboard");
  assert.ok(DEFAULTS.login.limit >= 30, "a whole class signing in together from one connection");
});

test("going over a limit gives 429, a Retry-After header and a readable message", async () => {
  const limits = createLimiters({ dashboard: { limit: 3 } });
  const { base, close } = await serve((app) => app.get("/x", limits.authed, answer));
  const auth = { Authorization: `Bearer ${token("u1")}` };
  assert.deepEqual(await statuses(3, base, "/x", auth), [200, 200, 200]);
  const res = await hit(base, "/x", auth);
  assert.equal(res.status, 429);
  const retry = Number(res.headers.get("retry-after"));
  assert.ok(retry >= 1 && retry <= 60, `Retry-After was ${retry}`);
  assert.ok(res.headers.get("ratelimit"), "standard RateLimit header is present");
  const body = await res.json();
  assert.match(body.error, /^Too many requests\. Please wait \d+ seconds? and try again\.$/);
  assert.equal(body.retry_after, retry);
  close();
});

test("signed-in people are limited one by one, not as a group", async () => {
  const limits = createLimiters({ dashboard: { limit: 2 } });
  const { base, close } = await serve((app) => app.get("/x", limits.authed, answer));
  const alice = { Authorization: `Bearer ${token("alice")}` };
  const bob = { Authorization: `Bearer ${token("bob")}` };
  assert.deepEqual(await statuses(3, base, "/x", alice), [200, 200, 429]);
  assert.deepEqual(await statuses(2, base, "/x", bob), [200, 200], "Alice using her limit must not touch Bob's");
  close();
});

test("people on the same network address do not use up each other's limit", async () => {
  const limits = createLimiters({ dashboard: { limit: 2 } });
  const { base, close } = await serve((app) => app.get("/x", limits.authed, answer));
  const from = (id) => ({ Authorization: `Bearer ${token(id)}`, "X-Forwarded-For": "203.0.113.7" }); // same school Wi-Fi
  assert.deepEqual(await statuses(3, base, "/x", from("a")), [200, 200, 429]);
  assert.deepEqual(await statuses(3, base, "/x", from("b")), [200, 200, 429], "b has a fresh limit of their own");
  close();
});

test("a request with no valid login never reaches the limiter or the handler", async () => {
  const limits = createLimiters({ dashboard: { limit: 1 } });
  let reached = 0;
  const { base, close } = await serve((app) => app.get("/x", limits.authed, (req, res) => { reached++; res.json({}); }));
  assert.deepEqual(await statuses(3, base, "/x", {}), [401, 401, 401]);
  assert.deepEqual(await statuses(2, base, "/x", { Authorization: "Bearer not-a-token" }), [401, 401]);
  assert.equal(reached, 0);
  close();
});

test("each device has its own limit; two devices of one person do not share it", async () => {
  const limits = createLimiters({ ingest: { limit: 3 } });
  const { base, close } = await serve((app) => {
    // stands in for ingestAuth, which sets these two after checking the key
    app.use((req, res, next) => {
      req.user = { id: req.headers["x-user"] };
      if (req.headers["x-device"]) req.device = { id: req.headers["x-device"] };
      next();
    });
    app.get("/log", limits.ingest, answer);
  });
  const dev = (user, device) => ({ "x-user": user, "x-device": device });
  assert.deepEqual(await statuses(4, base, "/log", dev("u1", "laptop")), [200, 200, 200, 429]);
  assert.deepEqual(await statuses(3, base, "/log", dev("u1", "desktop")), [200, 200, 200], "same person, other device");
  assert.deepEqual(await statuses(3, base, "/log", dev("u2", "phone")), [200, 200, 200], "another person");
  // defensive only: the real route always has a device (ingestAuth refuses everything else), but if one
  // were ever missing the person would be limited instead of nobody
  assert.deepEqual(await statuses(4, base, "/log", { "x-user": "no-device" }), [200, 200, 200, 429]);
  close();
});

test("a made-up X-Forwarded-For cannot dodge a limit that counts by address", async () => {
  const limits = createLimiters({ login: { limit: 2 } });
  const { base, close } = await serve((app) => app.post("/login", limits.login, answer), { trustProxy: 1 });
  const post = (xff) => hit(base, "/login", { "X-Forwarded-For": xff }, "POST").then((r) => r.status);
  // The proxy appends the real caller on the right; anything the caller invents sits to its left.
  assert.equal(await post("1.1.1.1, 198.51.100.9"), 200);
  assert.equal(await post("2.2.2.2, 198.51.100.9"), 200);
  assert.equal(await post("3.3.3.3, 198.51.100.9"), 429, "inventing a new left-hand address must not help");
  assert.equal(await post("198.51.100.10"), 200, "a different real caller has their own count");
  close();
});

test("wrong keys are counted, successes and other errors are not", async () => {
  const limits = createLimiters({ authFails: { limit: 3 } });
  const { base, close } = await serve((app) => app.post("/log", limits.authFails, answer));
  const send = (status) => hit(base, "/log", { "x-status": String(status), "X-Forwarded-For": "198.51.100.1" }, "POST").then((r) => r.status);
  for (let i = 0; i < 10; i++) assert.equal(await send(200), 200, "successful requests never count");
  for (let i = 0; i < 5; i++) assert.equal(await send(500), 500, "server errors are not the caller's fault");
  assert.equal(await send(401), 401);
  assert.equal(await send(403), 403);
  assert.equal(await send(401), 401);
  assert.equal(await send(200), 429, "after 3 wrong keys even a right one waits a little");
  close();
});

test("wrong pairing codes are counted, good ones are not", async () => {
  const limits = createLimiters({ pairFails: { limit: 2 } });
  const { base, close } = await serve((app) => app.post("/pair", limits.pairFails, answer));
  const send = (status) => hit(base, "/pair", { "x-status": String(status), "X-Forwarded-For": "198.51.100.2" }, "POST").then((r) => r.status);
  for (let i = 0; i < 5; i++) assert.equal(await send(200), 200);
  assert.equal(await send(400), 400);
  assert.equal(await send(400), 400);
  assert.equal(await send(400), 429);
  close();
});

test("rejected sign-ins are counted, accepted ones are not", async () => {
  const limits = createLimiters({ loginFails: { limit: 2 } });
  const { base, close } = await serve((app) => app.post("/auth", limits.loginFails, answer));
  const send = (status) => hit(base, "/auth", { "x-status": String(status), "X-Forwarded-For": "198.51.100.3" }, "POST").then((r) => r.status);
  for (let i = 0; i < 5; i++) assert.equal(await send(200), 200);
  assert.equal(await send(401), 401);
  assert.equal(await send(401), 401);
  assert.equal(await send(401), 429);
  close();
});

test("deleting is limited much harder than reading", async () => {
  const limits = createLimiters({ destructive: { limit: 2 }, dashboard: { limit: 100 } });
  const { base, close } = await serve((app) => {
    app.get("/read", limits.authed, answer);
    app.delete("/delete", limits.authedDestructive, answer);
  });
  const auth = { Authorization: `Bearer ${token("u1")}` };
  assert.deepEqual(await statuses(10, base, "/read", auth), Array(10).fill(200));
  const del = [];
  for (let i = 0; i < 3; i++) del.push((await hit(base, "/delete", auth, "DELETE")).status);
  assert.deepEqual(del, [200, 200, 429]);
  close();
});

test("RATE_LIMIT_DISABLED=true switches every limit off", async () => {
  const limits = createLimiters({ dashboard: { limit: 1 } });
  const { base, close } = await serve((app) => app.get("/x", limits.authed, answer));
  const auth = { Authorization: `Bearer ${token("u1")}` };
  process.env.RATE_LIMIT_DISABLED = "true";
  try {
    assert.deepEqual(await statuses(5, base, "/x", auth), Array(5).fill(200));
  } finally {
    delete process.env.RATE_LIMIT_DISABLED;
  }
  assert.deepEqual(await statuses(2, base, "/x", auth), [200, 429], "and back on once it is unset (the limit is 1: the first request passes, the second does not)");
  close();
});

test("trustProxyHops defaults to the measured value for Render and falls back to it on anything odd", () => {
  assert.equal(trustProxyHops(undefined), 3);
  assert.equal(trustProxyHops(""), 3);
  assert.equal(trustProxyHops("2"), 2);
  assert.equal(trustProxyHops("0"), 0);
  for (const bad of ["abc", "-1", "1.5", "true", "Infinity"]) assert.equal(trustProxyHops(bad), 3, bad);
});

// The three real X-Forwarded-For values Render sent on 4 Oct 2026 (the caller was 14.139.241.90;
// the middle entry is a Cloudflare server, the last Render's balancer; the test's own connection
// plays the part of the one proxy that is not in the header).
test("with the default, Render's real header chains give the caller's real address", async () => {
  const networkRouter = require("../routes/network");
  const { base, close } = await serve((app) => {
    app.set("trust proxy", trustProxyHops());
    app.use("/api", networkRouter);
  }, { trustProxy: trustProxyHops() });
  const realChains = [
    "14.139.241.90, 162.158.235.207, 10.31.0.148",
    "9.9.9.9,14.139.241.90, 104.23.209.99, 10.25.236.5", //          caller invented 9.9.9.9
    "9.9.9.9, 8.8.8.8,14.139.241.90, 172.69.94.242, 10.31.0.148", // caller invented two
  ];
  for (const chain of realChains) {
    const body = await (await fetch(`${base}/api/network-check`, { headers: { "X-Forwarded-For": chain } })).json();
    assert.equal(body.ip, "14.139.241.90", `chain: ${chain}`);
    assert.equal(body.trusted_proxy_hops, 3);
    assert.equal(body.forwarded_for_entries, chain.split(",").length);
  }
  const raw = await (await fetch(`${base}/api/network-check`, { headers: { "X-Forwarded-For": "10.1.2.3, 10.4.5.6" } })).text();
  assert.ok(!raw.includes("10.4.5.6"), "the raw header (it holds the host's internal addresses) must not be echoed back");
  close();
});

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "unit-test-secret";
// These tests are about what the routes do, not how often they may be called (see limits.test.js).
process.env.RATE_LIMIT_DISABLED = "true";

const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const Device = require("../models/Device");
const PairingCode = require("../models/PairingCode");
const User = require("../models/User");
const accountRouter = require("../routes/account");

// A real express app with the real router; only the database models are replaced.
const app = express();
app.use(express.json());
app.use("/api/account", accountRouter);

let server;
let base;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  delete process.env.RATE_LIMIT_DISABLED;
  server.close();
});

const ME = "6ac2400000000000000000aa";
const SOMEONE_ELSE = "6ac2400000000000000000bb";
const token = (id = ME) => jwt.sign({ id }, process.env.JWT_SECRET);

// Record every model call so a test can say exactly what was (and was not) touched.
let calls;
const result = (n) => ({ deletedCount: n });
const install = ({ failOn = null } = {}) => {
  calls = [];
  const record = (name, fn) => async (...args) => {
    calls.push({ name, args });
    if (failOn === name) throw new Error(`${name} failed`);
    return fn(...args);
  };
  Activity.deleteMany = record("Activity.deleteMany", () => result(120));
  DailyStat.deleteMany = record("DailyStat.deleteMany", () => result(4));
  Device.deleteMany = record("Device.deleteMany", () => result(2));
  PairingCode.deleteMany = record("PairingCode.deleteMany", () => result(1));
  User.deleteOne = record("User.deleteOne", () => result(1));
  Activity.countDocuments = record("Activity.countDocuments", () => 120);
  DailyStat.countDocuments = record("DailyStat.countDocuments", () => 4);
  Device.countDocuments = record("Device.countDocuments", () => 2);
  Activity.findOne = (...args) => {
    calls.push({ name: "Activity.findOne", args });
    return { sort: () => ({ select: () => ({ lean: async () => ({ timestamp: new Date("2026-08-12T05:00:00Z") }) }) }) };
  };
};

const call = (method, path, { auth = token(), body } = {}) =>
  fetch(`${base}/api/account${path}`, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), "Content-Type": "application/json" },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  });
const names = () => calls.map((c) => c.name);

test("everything needs a login", async () => {
  install();
  for (const [method, path] of [["GET", "/summary"], ["GET", "/export"], ["DELETE", "/data"], ["DELETE", ""]]) {
    const res = await call(method, path, { auth: null, body: { confirm: "DELETE" } });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
  assert.deepEqual(calls, [], "nothing may touch the database without a login");
});

test("summary reports what is held, for the caller only", async () => {
  install();
  const res = await call("GET", "/summary");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    samples: 120,
    first_sample: "2026-08-12T05:00:00.000Z",
    days_summarised: 4,
    devices: 2,
  });
  for (const c of calls) assert.equal(c.args[0].user, ME, `${c.name} must be filtered by the caller`);
  assert.deepEqual(calls.find((c) => c.name === "Device.countDocuments").args[0], { user: ME, revokedAt: null });
});

test("deleting needs the exact word DELETE; anything else deletes nothing", async () => {
  for (const path of ["/data", ""]) {
    for (const body of [undefined, {}, { confirm: true }, { confirm: "delete" }, { confirm: "yes" }, { confirm: "DELETE " }, { confirm: ["DELETE"] }]) {
      install();
      const res = await call("DELETE", path, { body });
      assert.equal(res.status, 400, `DELETE ${path || "/"} with ${JSON.stringify(body)}`);
      assert.deepEqual(calls, [], "no database call at all");
    }
  }
});

test("delete data removes samples and summaries, and nothing else", async () => {
  install();
  const res = await call("DELETE", "/data", { body: { confirm: "DELETE" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deleted: { samples: 120, days: 4 } });
  assert.deepEqual(names().sort(), ["Activity.deleteMany", "DailyStat.deleteMany"]);
  for (const c of calls) assert.deepEqual(c.args[0], { user: ME });
});

test("delete account removes everything of the caller, devices first and the user record last", async () => {
  install();
  const res = await call("DELETE", "", { body: { confirm: "DELETE" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deleted: { account: true, devices: 2, samples: 120, days: 4 } });
  assert.deepEqual(names(), [
    "Device.deleteMany",
    "Activity.deleteMany",
    "DailyStat.deleteMany",
    "PairingCode.deleteMany",
    "User.deleteOne",
  ]);
  for (const c of calls.slice(0, 4)) assert.deepEqual(c.args[0], { user: ME });
  assert.deepEqual(calls[4].args[0], { _id: ME });
});

test("one person's request can never name another person's data", async () => {
  install();
  await call("DELETE", "", { body: { confirm: "DELETE", user: SOMEONE_ELSE, _id: SOMEONE_ELSE } });
  await call("DELETE", "/data", { body: { confirm: "DELETE", user: SOMEONE_ELSE } });
  const serialized = JSON.stringify(calls);
  assert.ok(!serialized.includes(SOMEONE_ELSE), "a user id from the request body must never reach a query");
});

test("a failure part-way through keeps the account, so the person can simply try again", async () => {
  install({ failOn: "DailyStat.deleteMany" });
  const res = await call("DELETE", "", { body: { confirm: "DELETE" } });
  assert.equal(res.status, 500);
  assert.ok(!names().includes("User.deleteOne"), "the user record must survive a failed run");
  assert.ok(!names().includes("PairingCode.deleteMany"));

  install(); // second attempt works and finishes the job
  const again = await call("DELETE", "", { body: { confirm: "DELETE" } });
  assert.equal(again.status, 200);
  assert.ok(names().includes("User.deleteOne"));
});

test("a failed data delete reports an error instead of success", async () => {
  install({ failOn: "Activity.deleteMany" });
  const res = await call("DELETE", "/data", { body: { confirm: "DELETE" } });
  assert.equal(res.status, 500);
  assert.ok(!names().includes("DailyStat.deleteMany"), "summaries are not removed if the samples could not be");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "unit-test-secret";

const Device = require("../models/Device");
const ingestAuth = require("../middleware/ingestAuth");
const { sha256 } = require("../services/pairing");

// Run the middleware against a fake request/response (no server, no database).
const run = async (authorization) => {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const out = { status: null, body: null, nexted: false, req };
  const res = {
    status(code) { out.status = code; return this; },
    json(body) { out.body = body; return this; },
  };
  await ingestAuth(req, res, () => { out.nexted = true; });
  return out;
};

// Device.findOne(...).select(...).lean() resolves to `result`, or rejects if it is an Error.
const stubFindOne = (result, seenFilters = []) => {
  Device.findOne = (filter) => {
    seenFilters.push(filter);
    return { select: () => ({ lean: async () => { if (result instanceof Error) throw result; return result; } }) };
  };
};

test("an unknown or revoked key is a 401 (the sensor should stop)", async () => {
  stubFindOne(null);
  const out = await run("Device adk_unknown");
  assert.equal(out.status, 401);
  assert.equal(out.nexted, false);
});

test("a database failure is a 500, never a 401 (a healthy sensor must not think it was revoked)", async () => {
  stubFindOne(new Error("connection lost"));
  const out = await run("Device adk_whatever");
  assert.equal(out.status, 500);
  assert.equal(out.nexted, false);
});

test("lookup is by the hash of the key and only for non-revoked devices", async () => {
  const filters = [];
  stubFindOne(null, filters);
  await run("Device adk_secretvalue");
  assert.deepEqual(filters[0], { keyHash: sha256("adk_secretvalue"), revokedAt: null });
});

test("a valid device authenticates as its owner; lastSeen is written only when stale", async () => {
  const writes = [];
  Device.updateOne = async (...args) => { writes.push(args); };

  stubFindOne({ _id: "dev1", user: "user1", lastSeen: new Date() });
  let out = await run("Device adk_good");
  assert.equal(out.nexted, true);
  assert.deepEqual(out.req.user, { id: "user1" });
  assert.deepEqual(out.req.device, { id: "dev1" });
  assert.equal(writes.length, 0, "fresh lastSeen: no write");

  stubFindOne({ _id: "dev1", user: "user1", lastSeen: new Date(Date.now() - 60_000) });
  out = await run("Device adk_good");
  assert.equal(out.nexted, true);
  assert.equal(writes.length, 1, "stale lastSeen: one write");

  stubFindOne({ _id: "dev1", user: "user1" });
  await run("Device adk_good");
  assert.equal(writes.length, 2, "never seen: one write");
});

test("an empty key is rejected without touching the database", async () => {
  let queried = false;
  Device.findOne = () => { queried = true; };
  const out = await run("Device    ");
  assert.equal(out.status, 401);
  assert.equal(queried, false);
});

test("anything that is not a Device header falls back to the session-token check", async () => {
  Device.findOne = () => { throw new Error("must not be consulted"); };

  let out = await run(`Bearer ${jwt.sign({ id: "user9" }, process.env.JWT_SECRET)}`);
  assert.equal(out.nexted, true);
  assert.equal(out.req.user.id, "user9");

  out = await run("Bearer not-a-jwt");
  assert.equal(out.status, 401);
  out = await run(undefined);
  assert.equal(out.status, 401);
});

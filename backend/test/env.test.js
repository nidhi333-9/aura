const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { describeMongoTarget } = require("../config/mongoTarget");

const LOADER = path.join(__dirname, "..", "config", "env.js");

// Run the loader against a temp "backend" folder in a CLEAN child process (a loaded dotenv
// file can't be un-loaded, so each case needs its own process) and report what it produced.
const load = ({ envFile, localFile, preset = {} }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aura-env-"));
  if (envFile !== undefined) fs.writeFileSync(path.join(root, ".env"), envFile);
  if (localFile !== undefined) fs.writeFileSync(path.join(root, ".env.local"), localFile);
  const out = execFileSync(
    process.execPath,
    ["-e", `
      const result = require(${JSON.stringify(LOADER)})(${JSON.stringify(root)});
      console.log(JSON.stringify({ result, A: process.env.A, B: process.env.B, C: process.env.C }));
    `],
    { env: { PATH: process.env.PATH, ...preset }, encoding: "utf8" },
  );
  fs.rmSync(root, { recursive: true, force: true });
  return JSON.parse(out);
};

test(".env.local beats .env, and variables only in one file still come through", () => {
  const r = load({ envFile: "A=from_env\nB=only_env\n", localFile: "A=from_local\nC=only_local\n" });
  assert.equal(r.A, "from_local");
  assert.equal(r.B, "only_env");
  assert.equal(r.C, "only_local");
  assert.deepEqual(r.result.loaded, [".env.local", ".env"]);
});

test("real environment variables (what Render provides) beat both files", () => {
  const r = load({ envFile: "A=from_env\n", localFile: "A=from_local\n", preset: { A: "from_real_env" } });
  assert.equal(r.A, "from_real_env");
});

test("works with only .env (production-style), only .env.local, or neither", () => {
  assert.deepEqual(load({ envFile: "A=1\n" }).result.loaded, [".env"]);
  assert.equal(load({ envFile: "A=1\n" }).A, "1");
  assert.deepEqual(load({ localFile: "A=2\n" }).result.loaded, [".env.local"]);
  const none = load({});
  assert.deepEqual(none.result.loaded, []);
  assert.equal(none.A, undefined);
});

// ---------------------------------------------------------------- database target description
test("describeMongoTarget: local vs remote, for every shape of connection string", () => {
  const cases = [
    ["mongodb://localhost:27017/aura", "local", "aura"],
    ["mongodb://127.0.0.1:27099/auraTest", "local", "auraTest"],
    ["mongodb://[::1]:27017/x", "local", "x"],
    ["mongodb://localhost/aura?retryWrites=true", "local", "aura"],
    ["mongodb://localhost:27017", "local", "(default)"],
    ["mongodb+srv://user:pw@cluster0.abcde.mongodb.net/aura?retryWrites=true&w=majority", "remote", "aura"],
    ["mongodb://user:pw@h1.example.com:27017,h2.example.com:27017/db?replicaSet=rs0", "remote", "db"],
    ["mongodb://user:pw@mongo.internal:27017/aura", "remote", "aura"],
    // a mixed list is only "local" if EVERY host is
    ["mongodb://localhost:27017,remote.example.com:27017/db", "remote", "db"],
    ["mongodb+srv://user:p%40ss@cluster0.abcde.mongodb.net/my%20db", "remote", "my db"],
  ];
  for (const [uri, kind, db] of cases) {
    assert.deepEqual(describeMongoTarget(uri), { kind, db }, uri);
  }
});

test("describeMongoTarget never leaks credentials or hosts, and tolerates junk", () => {
  const secretUri = "mongodb+srv://admin:Sup3rSecretPw@cluster0.abcde.mongodb.net/aura";
  const described = JSON.stringify(describeMongoTarget(secretUri));
  assert.ok(!described.includes("Sup3rSecretPw") && !described.includes("admin") && !described.includes("abcde"), described);
  for (const junk of [undefined, null, "", "not a uri", "http://localhost:27017/x", 42]) {
    assert.equal(describeMongoTarget(junk).kind, "unknown", String(junk));
  }
});

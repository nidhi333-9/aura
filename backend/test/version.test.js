const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.JWT_SECRET = "unit-test-secret";

const versionRouter = require("../routes/version");
const { judge } = require("../scripts/check-deploy");

const app = express();
app.use("/api", versionRouter);

let server;
let base;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  delete process.env.RENDER_GIT_COMMIT;
  server.close();
});

const version = async (commit) => {
  if (commit === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = commit;
  const res = await fetch(`${base}/api/version`);
  return { status: res.status, body: await res.json() };
};

test("the page shows the short commit that Render reports, and when the server started", async () => {
  const { status, body } = await version("1691622ab0c5d9f3e8a47c1d2b3e4f5a6b7c8d9e");
  assert.equal(status, 200);
  assert.equal(body.commit, "1691622");
  assert.ok(!Number.isNaN(Date.parse(body.started_at)), "started_at is a real timestamp");
  assert.deepEqual(Object.keys(body).sort(), ["commit", "started_at"], "nothing else is shown");
});

test("a short commit id is shown as given, in lower case", async () => {
  assert.equal((await version("ABCDEF1")).body.commit, "abcdef1");
});

test("outside Render (no commit known) the commit is null", async () => {
  assert.equal((await version(undefined)).body.commit, null);
  assert.equal((await version("")).body.commit, null);
});

test("only a plain commit id is ever shown, never whatever the environment contains", async () => {
  for (const hostile of ["not-a-commit", "<script>alert(1)</script>", "1691622 && echo hi", "zzzzzzz", "123456", "g".repeat(40), "a".repeat(41), "../../etc/passwd", "secret-value-123456"]) {
    assert.equal((await version(hostile)).body.commit, null, JSON.stringify(hostile));
  }
});

// ---------------------------------------------------------------- the checker's decision
const latest = { sha: "1691622ab0c5d9f3e8a47c1d2b3e4f5a6b7c8d9e", message: "Update vulnerable packages" };

test("check-deploy: the live commit equals GitHub's newest -> up to date, exit 0", () => {
  const r = judge({ commit: "1691622", started_at: "2026-10-05T02:44:00.000Z" }, latest);
  assert.equal(r.verdict, "UP TO DATE");
  assert.equal(r.exit, 0);
  assert.match(r.text, /1691622/);
});

test("check-deploy: a different commit -> behind, says both and what to do, exit 1", () => {
  const r = judge({ commit: "2a44ac5" }, latest);
  assert.equal(r.verdict, "BEHIND");
  assert.equal(r.exit, 1);
  assert.match(r.text, /2a44ac5/);
  assert.match(r.text, /1691622/);
  assert.match(r.text, /Update vulnerable packages/);
  assert.match(r.text, /Auto-Deploy/);
});

test("check-deploy: a backend without the version page (older than this feature) -> unknown, exit 1", () => {
  for (const live of [null, undefined, {}, { commit: null }, { commit: 123 }]) {
    const r = judge(live, latest);
    assert.equal(r.verdict, "UNKNOWN", JSON.stringify(live));
    assert.equal(r.exit, 1);
  }
});

test("check-deploy: a missing commit message is tolerated", () => {
  const r = judge({ commit: "2a44ac5" }, { sha: latest.sha, message: "" });
  assert.equal(r.verdict, "BEHIND");
  assert.ok(!r.text.includes('("")'));
});

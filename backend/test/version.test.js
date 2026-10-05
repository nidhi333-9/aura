const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.JWT_SECRET = "unit-test-secret";

const versionRouter = require("../routes/version");
const { judge, parseArgs } = require("../scripts/check-deploy");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

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

test("check-deploy: when given an explicit commit, the wording says 'asked to run', not 'newest on GitHub'", () => {
  const ok = judge({ commit: "abc1234" }, { sha: "abc1234ffff", message: "", asked: true });
  assert.match(ok.text, /the commit it was asked to run/);
  assert.doesNotMatch(ok.text, /newest commit on GitHub/);
  const behind = judge({ commit: "2a44ac5" }, { sha: "abc1234ffff", message: "", asked: true });
  assert.match(behind.text, /the expected commit is abc1234/);
});

test("check-deploy: a missing commit message is tolerated", () => {
  const r = judge({ commit: "2a44ac5" }, { sha: latest.sha, message: "" });
  assert.equal(r.verdict, "BEHIND");
  assert.ok(!r.text.includes('("")'));
});

// ---------------------------------------------------------------- the checker's options
test("check-deploy options: defaults, and strict reading of the new ones", () => {
  const d = parseArgs(["node", "check-deploy.js"]);
  assert.equal(d.commit, null);
  assert.equal(d.waitSeconds, 0);
  assert.equal(d.everySeconds, 10);
  assert.equal(d.url, "https://aura-backend-hmq3.onrender.com");
  const w = parseArgs(["node", "x", "--commit", "ABC1234", "--wait", "600", "--every", "5", "--url", "http://h:1/"]);
  assert.deepEqual([w.commit, w.waitSeconds, w.everySeconds, w.url], ["ABC1234", 600, 5, "http://h:1"]);
  for (const bad of [["--commit", "nothex"], ["--commit", "abc"], ["--commit", "g".repeat(10)], ["--wait", "-1"], ["--wait", "soon"], ["--every", "0"], ["--every", "x"]]) {
    assert.throws(() => parseArgs(["node", "x", ...bad]), /needs a/, JSON.stringify(bad));
  }
});

// ---------------------------------------------------------------- the checker, run for real
const SCRIPT = path.join(__dirname, "..", "scripts", "check-deploy.js");
const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
const fakeBackend = (answers) => {
  let n = 0;
  const srv = http.createServer((req, res) => {
    const a = answers[Math.min(n++, answers.length - 1)];
    if (a === "404") { res.writeHead(404); return res.end("nope"); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(a));
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}`, calls: () => n })));
};

test("check-deploy --wait: succeeds as soon as the live backend reports the expected commit", async () => {
  const b = await fakeBackend(["404", { commit: "1111111" }, { commit: "1111111" }, { commit: "abc1234", started_at: "2026-10-05T03:00:00.000Z" }]);
  const r = await run(["--url", b.url, "--commit", "abc1234", "--wait", "20", "--every", "0.3"]);
  b.srv.close();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[waiting/);
  assert.match(r.out, /UP TO DATE/);
  assert.equal(b.calls(), 4, "it stopped asking the moment it was live");
});

test("check-deploy --wait: gives up at the deadline with exit 1 when the commit never arrives", async () => {
  const b = await fakeBackend([{ commit: "1111111" }]);
  const started = Date.now();
  const r = await run(["--url", b.url, "--commit", "abc1234", "--wait", "1.2", "--every", "0.3"]);
  b.srv.close();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /BEHIND/);
  assert.ok(Date.now() - started < 8000, "it did not wait far past the deadline");
});

test("check-deploy --wait: a server that is restarting (not answering yet) is waited for, not an error", async () => {
  const b = await fakeBackend([{ commit: "abc1234" }]);
  const port = new URL(b.url).port;
  b.srv.close(); // nothing is listening now
  const pending = run(["--url", `http://127.0.0.1:${port}`, "--commit", "abc1234", "--wait", "15", "--every", "0.3"]);
  await new Promise((r) => setTimeout(r, 1200));
  const revived = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ commit: "abc1234" })); });
  await new Promise((resolve) => revived.listen(Number(port), "127.0.0.1", resolve));
  const r = await pending;
  revived.close();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /UP TO DATE/);
});

test("check-deploy without --wait: an unreachable backend is exit 2 ('could not check'), not a verdict", async () => {
  const b = await fakeBackend([{ commit: "abc1234" }]);
  const port = new URL(b.url).port;
  b.srv.close();
  const r = await run(["--url", `http://127.0.0.1:${port}`, "--commit", "abc1234"]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /Could not reach/);
});

test("check-deploy: bad options stop with exit 2 before any request", async () => {
  const r = await run(["--commit", "not-a-commit"]);
  assert.equal(r.code, 2);
  assert.match(r.out, /--commit needs a commit id/);
});

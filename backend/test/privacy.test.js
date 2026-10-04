const test = require("node:test");
const assert = require("node:assert/strict");
const { redactTitle, HIDDEN, MAX_INPUT_LENGTH } = require("../services/privacy");

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2I2OWE4NWFjNmZlOTlmYmQ4MDIzNSIsImlhdCI6MTc5MTExMzI1NiJ9.Wc7MSchsDWhP85oyhUckpFt6c1RY7hQrhcF0m4ImeFg";

test("a login token in an address is removed (the real case: the old sensor's callback page)", () => {
  const out = redactTitle(`localhost:9999/?token=${JWT}`);
  assert.ok(!out.includes("eyJ"), out);
  assert.ok(!out.includes(JWT.slice(10, 30)), out);
  assert.equal(out, `localhost:9999/?${HIDDEN}`);
});

test("a token anywhere in a title is removed, even without an address around it", () => {
  const out = redactTitle(`Debug session ${JWT} - Notes`);
  assert.equal(out, `Debug session ${HIDDEN} - Notes`);
});

test("everything after ? or # in an address is hidden, the host and path stay", () => {
  assert.equal(
    redactTitle("accounts.google.com/signin/oauth/v3/consent?authuser=0&part=AJi8hANQKa3zGvFkk0NL4mEMc"),
    `accounts.google.com/signin/oauth/v3/consent?${HIDDEN}`,
  );
  assert.equal(redactTitle("https://example.com/reset?code=123456&email=me@x.com"), `https://example.com/reset?${HIDDEN}`);
  assert.equal(redactTitle("app.example.com/cb#access_token=abc123&state=xyz"), `app.example.com/cb?${HIDDEN}`);
});

test("secret-looking parameters are hidden even when the rest of the title is ordinary text", () => {
  const out = redactTitle("Reset password - ?token=abc123def456 - Mail");
  assert.ok(!out.includes("abc123def456"), out);
  assert.ok(out.startsWith("Reset password"), out);
  assert.ok(out.endsWith("Mail"), out);
  assert.ok(!redactTitle("login&password=hunter2 form").includes("hunter2"));
  assert.ok(!redactTitle("page;sid=SECRETVALUE").includes("SECRETVALUE"));
});

test("ordinary titles come out exactly as they went in", () => {
  const ordinary = [
    "What is Java? - Google Search",
    "Is node.js worth it? Yes!",
    "C# tutorial for beginners - YouTube",
    "C++ #1: pointers explained",
    "Feed | LinkedIn",
    "(3) Inbox (12) - me@example.com - Gmail",
    "mongodb atlas - Google Search",
    "DSA-for-Interviews/Resources/Cracking the Coding Interview, 6th Edition.pdf at main · user/repo",
    "black-shadows/Cracking-the-Coding-Interview: Learn how to uncover the hints",
    "Python 3.11? Check this out",
    "50:00 - Time to focus!",
    "index.js — aura",
    "BinaryStringWithoutConsecutiveOnes.cpp - CPP - Visual Studio Code",
    "How do I use the ? operator in Rust",
    "Unknown",
    "",
    "Courses · Prabhupada World",
    "Download - MEGA 52%",
    "https://example.com/some/page",
    "localhost:5173/dashboard",
    "Tokens and keys explained - a security guide",
    "The code of conduct",
  ];
  for (const title of ordinary) {
    assert.equal(redactTitle(title), title, `changed: ${title}`);
  }
});

test("missing or odd input never throws", () => {
  for (const value of [undefined, null, 42, {}, [], true]) {
    assert.equal(typeof redactTitle(value), "string");
  }
  assert.equal(redactTitle(undefined), "");
  assert.equal(redactTitle(null), "");
});

test("only the first MAX_INPUT_LENGTH characters are looked at", () => {
  assert.equal(redactTitle("a".repeat(MAX_INPUT_LENGTH + 500)).length, MAX_INPUT_LENGTH);
});

test("hostile input cannot make it slow", () => {
  const nasty = [
    "a.".repeat(1500),
    "a-".repeat(1500),
    `${"a.".repeat(900)}?`,
    "?".repeat(2000),
    "token=".repeat(400),
    "eyJ" + "a".repeat(1990),
    "http://" + "x.".repeat(900),
  ];
  const start = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) for (const input of nasty) redactTitle(input);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 1500, `140 hostile titles took ${ms.toFixed(0)} ms`);
});

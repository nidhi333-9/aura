const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "unit-test-secret";
// These tests are about what the download contains, not how often it may be asked for (see limits.test.js).
process.env.RATE_LIMIT_DISABLED = "true";

const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const Device = require("../models/Device");
const User = require("../models/User");
const accountRouter = require("../routes/account");

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
  server.closeAllConnections?.();
  server.close();
});

const ME = "6ac2400000000000000000aa";
const SOMEONE_ELSE = "6ac2400000000000000000bb";
const token = (id = ME) => jwt.sign({ id }, process.env.JWT_SECRET);
const get = (path = "/export", { auth = token(), signal } = {}) =>
  fetch(`${base}/api/account${path}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {}, signal });

// ---------------------------------------------------------------- stand-ins for the database
const PROFILE = {
  _id: ME,
  googleId: "google-id-123",
  email: "student@example.com",
  name: "Test Student",
  picture: "https://example.com/p.png",
  createdAt: new Date("2026-08-01T10:00:00Z"),
  __v: 0,
};
const DEVICES = [
  {
    _id: "d1",
    user: ME,
    name: "Test Laptop",
    os: "macOS",
    keyHash: "KEYHASH-MUST-NEVER-APPEAR-0123456789abcdef",
    createdAt: new Date("2026-08-02T08:00:00Z"),
    lastSeen: new Date("2026-10-04T12:00:00Z"),
    revokedAt: null,
  },
];

const sample = (i, extra = {}) => ({
  _id: `s${i}`,
  user: ME,
  __v: 0,
  app_name: "Google Chrome",
  window_title: `Page ${i}`,
  domain: "example.com",
  site: "Example",
  category: "Neutral",
  timestamp: new Date(Date.UTC(2026, 9, 4, 8, 0, 0) + i * 10_000),
  ...extra,
});

// A cursor like Mongoose's: an async iterable with close(), which records that it was closed.
// `rows` is an array or a function (i) => row (endless when `endless`). `failAt` throws at that row.
const makeCursor = (rows, { failAt = null, endless = false, delayMs = 0 } = {}) => {
  const cursor = { closed: false, served: 0 };
  cursor.close = async () => { cursor.closed = true; };
  cursor[Symbol.asyncIterator] = async function* () {
    for (let i = 0; endless || i < rows.length; i++) {
      if (failAt !== null && i === failAt) throw new Error("database went away");
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      cursor.served = i + 1;
      yield typeof rows === "function" ? rows(i) : rows[i];
    }
  };
  return cursor;
};

let filters; // every filter passed to a query, to prove the caller's id is the only one used
let cursors;
const install = ({ profile = PROFILE, devices = DEVICES, days = [], samples = [], samplesOptions = {}, failProfile = false } = {}) => {
  filters = [];
  cursors = {};
  User.findById = (id) => {
    filters.push({ model: "User.findById", id });
    return { lean: async () => { if (failProfile) throw new Error("db down"); return profile; } };
  };
  Device.find = (filter) => {
    filters.push({ model: "Device.find", filter });
    return { sort: () => ({ lean: async () => devices }) };
  };
  const chain = (name, rows, options) => (filter) => {
    filters.push({ model: name, filter });
    return {
      sort: () => ({ lean: () => ({ batchSize: () => ({ cursor: () => (cursors[name] = makeCursor(rows, options)) }) }) }),
    };
  };
  DailyStat.find = chain("DailyStat.find", days);
  Activity.find = chain("Activity.find", samples, samplesOptions);
};

const waitFor = async (condition, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (condition()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return condition();
};

// ---------------------------------------------------------------- the tests
test("the download needs a login", async () => {
  install();
  const res = await get("/export", { auth: null });
  assert.equal(res.status, 401);
  assert.deepEqual(filters, [], "nothing may touch the database without a login");
});

test("it is a downloadable JSON file that is never cached", async () => {
  install({ samples: [sample(1)] });
  const res = await get();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^application\/json/);
  assert.match(res.headers.get("content-disposition"), /^attachment; filename="aura-data-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  await res.text();
});

test("the file holds the profile, devices, summaries and samples, in time order, with totals at the end", async () => {
  const days = [
    { _id: "x1", user: ME, day: "2026-10-03", slots: { 37: { p: 12, n: 3 } } },
    { _id: "x2", user: ME, day: "2026-10-04", slots: { 38: { d: 1 } } },
  ];
  install({ days, samples: [sample(1), sample(2), sample(3)] });
  const res = await get();
  const file = await res.json();

  assert.deepEqual(Object.keys(file), ["about", "account", "devices", "daily_summaries", "samples", "counts"]);
  assert.equal(file.about.format, 1);
  assert.ok(!Number.isNaN(Date.parse(file.about.generated_at)));
  assert.deepEqual(file.account, {
    name: "Test Student",
    email: "student@example.com",
    picture: "https://example.com/p.png",
    google_id: "google-id-123",
    created_at: "2026-08-01T10:00:00.000Z",
  });
  assert.deepEqual(file.devices, [
    { name: "Test Laptop", os: "macOS", paired_at: "2026-08-02T08:00:00.000Z", last_seen: "2026-10-04T12:00:00.000Z", removed_at: null },
  ]);
  assert.deepEqual(file.daily_summaries, [
    { day: "2026-10-03", slots: { 37: { p: 12, n: 3 } } },
    { day: "2026-10-04", slots: { 38: { d: 1 } } },
  ]);
  assert.deepEqual(file.samples[0], {
    timestamp: "2026-10-04T08:00:10.000Z",
    app_name: "Google Chrome",
    window_title: "Page 1",
    domain: "example.com",
    site: "Example",
    category: "Neutral",
  });
  assert.deepEqual(file.samples.map((s) => s.window_title), ["Page 1", "Page 2", "Page 3"]);
  assert.deepEqual(file.counts, { daily_summaries: 2, samples: 3 });
});

test("secrets and internal ids never reach the file, even when the database rows carry them", async () => {
  const dirtySample = sample(1, { keyHash: "SAMPLE-KEYHASH", password: "hunter2", authToken: "TOKEN-IN-ROW" });
  const dirtyDay = { _id: "x1", user: ME, day: "2026-10-03", slots: {}, secret: "DAY-SECRET", __v: 3 };
  install({ days: [dirtyDay], samples: [dirtySample] });
  const text = await (await get()).text();
  for (const forbidden of ["KEYHASH-MUST-NEVER-APPEAR", "keyHash", "SAMPLE-KEYHASH", "hunter2", "TOKEN-IN-ROW", "DAY-SECRET", "\"_id\"", "__v", ME, "\"user\""]) {
    assert.ok(!text.includes(forbidden), `the file must not contain ${forbidden}`);
  }
});

test("only the caller's rows are asked for, whatever the request says", async () => {
  install({ samples: [sample(1)] });
  const res = await fetch(`${base}/api/account/export?user=${SOMEONE_ELSE}&_id=${SOMEONE_ELSE}`, {
    headers: { Authorization: `Bearer ${token()}`, "X-User": SOMEONE_ELSE },
  });
  await res.text();
  assert.equal(filters.length, 4, "profile, devices, summaries and samples");
  assert.ok(!JSON.stringify(filters).includes(SOMEONE_ELSE), "an id from the request must never reach a query");
  assert.equal(filters.find((f) => f.model === "User.findById").id, ME);
  for (const f of filters.filter((x) => x.filter)) assert.deepEqual(f.filter, { user: ME }, f.model);
});

test("an account with nothing tracked still downloads: valid JSON with empty lists", async () => {
  install();
  const file = await (await get()).json();
  assert.deepEqual(file.daily_summaries, []);
  assert.deepEqual(file.samples, []);
  assert.deepEqual(file.counts, { daily_summaries: 0, samples: 0 });
  assert.equal(file.account.email, "student@example.com");
});

test("missing fields and damaged rows do not break the file", async () => {
  const rows = [
    { app_name: "Terminal", timestamp: new Date("2026-10-04T08:00:00Z") }, // old row: no title, site or category
    { app_name: "Chrome", window_title: "bad date", timestamp: "not a date" },
    { app_name: "Chrome", window_title: "no date at all" },
  ];
  install({ samples: rows, profile: { _id: ME } });
  const file = await (await get()).json();
  assert.equal(file.samples.length, 3);
  assert.equal(file.samples[0].window_title, null);
  assert.equal(file.samples[1].timestamp, null);
  assert.equal(file.samples[2].timestamp, null);
  assert.equal(file.account.email, null);
});

test("awkward characters in titles survive the round trip exactly", async () => {
  const titles = ['He said "hi" \\ and left', "line one\nline two\ttabbed", "emoji 🎧 and 日本語 and Ünïcödé", "separators     inside", "</script><b>not html</b>", "{\"json\":[1,2,3]}"];
  install({ samples: titles.map((t, i) => sample(i, { window_title: t })) });
  const file = await (await get()).json();
  assert.deepEqual(file.samples.map((s) => s.window_title), titles);
});

test("a big account streams as valid JSON with exact totals", async () => {
  const N = 40_000;
  const days = Array.from({ length: 400 }, (_, i) => ({ day: `2025-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}#${i}`, slots: { 1: { p: i } } }));
  install({ days, samples: Array.from({ length: N }, (_, i) => sample(i, { window_title: `Row number ${i} ${"x".repeat(60)}` })) });
  const res = await get();
  const text = await res.text();
  assert.ok(text.length > 5_000_000, `a large body was produced (${text.length} characters)`);
  const file = JSON.parse(text);
  assert.equal(file.samples.length, N);
  assert.equal(file.daily_summaries.length, 400);
  assert.deepEqual(file.counts, { daily_summaries: 400, samples: N });
  assert.equal(file.samples[N - 1].window_title, `Row number ${N - 1} ${"x".repeat(60)}`);
  assert.ok(cursors["Activity.find"].closed && cursors["DailyStat.find"].closed, "both cursors are closed at the end");
});

test("the database failing before anything is sent gives a normal error, not a broken download", async () => {
  install({ failProfile: true });
  let res = await get();
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /Could not prepare your download/);

  install({ samples: Array.from({ length: 10 }, (_, i) => sample(i)), samplesOptions: { failAt: 0 } });
  res = await get();
  assert.equal(res.status, 500, "a failure on the very first row is still before the first byte");
  assert.equal(res.headers.get("content-disposition"), null, "no file was offered");
  assert.ok(cursors["Activity.find"].closed, "its cursor was closed");
});

test("a failure part-way through breaks the download instead of ending it as if it were whole", async () => {
  // Enough rows before the failure that the first part has already been sent.
  const rows = Array.from({ length: 3000 }, (_, i) => sample(i, { window_title: "y".repeat(200) + i }));
  install({ samples: rows, samplesOptions: { failAt: 2500 } });
  const res = await get();
  assert.equal(res.status, 200, "the file had already started when the failure happened");
  await assert.rejects(() => res.text(), "the body must end in an error, never a clean finish");
  assert.ok(await waitFor(() => cursors["Activity.find"].closed), "the cursor is closed after the failure");
});

test("cancelling the download stops the database reads and closes the cursor", async () => {
  // An endless supply of rows: only the person cancelling can end this download.
  install({ samples: (i) => sample(i, { window_title: "z".repeat(200) }), samplesOptions: { endless: true, delayMs: 0 } });
  const abort = new AbortController();
  const res = await get("/export", { signal: abort.signal });
  const reader = res.body.getReader();
  let received = 0;
  while (received < 200_000) {
    const { value, done } = await reader.read();
    assert.ok(!done, "the endless stream cannot finish by itself");
    received += value.length;
  }
  abort.abort();
  await reader.read().catch(() => {});
  assert.ok(await waitFor(() => cursors["Activity.find"].closed), "the cursor is closed after the person cancels");
  const servedAtCancel = cursors["Activity.find"].served;
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(cursors["Activity.find"].served, servedAtCancel, "no more rows are read after the cancel");
  assert.ok(servedAtCancel < 100_000, `it did not run ahead of the reader (${servedAtCancel} rows read)`);
});

test("a login token for a deleted account gets a clear answer and nothing is streamed", async () => {
  install({ profile: null, samples: [sample(1)] });
  const res = await get();
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /no longer exists/);
  assert.equal(cursors["Activity.find"], undefined, "no samples were even queried");
});

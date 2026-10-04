const test = require("node:test");
const assert = require("node:assert/strict");

const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const rollups = require("../services/rollups");
const { buildHistory } = require("../services/history");

const { locate, incrementFor, addSample, groupsFromDocs, recordSample, SLOT_MS } = rollups;

const iso = (s) => Date.parse(s);

// ---------------------------------------------------------------- slot arithmetic
test("locate: UTC day and 15-minute slot, including every boundary", () => {
  assert.deepEqual(locate(iso("2026-10-02T00:00:00.000Z")), { day: "2026-10-02", slot: 0 });
  assert.deepEqual(locate(iso("2026-10-02T00:14:59.999Z")), { day: "2026-10-02", slot: 0 });
  assert.deepEqual(locate(iso("2026-10-02T00:15:00.000Z")), { day: "2026-10-02", slot: 1 });
  assert.deepEqual(locate(iso("2026-10-02T12:00:00.000Z")), { day: "2026-10-02", slot: 48 });
  assert.deepEqual(locate(iso("2026-10-02T23:59:59.999Z")), { day: "2026-10-02", slot: 95 });
  assert.deepEqual(locate(iso("2026-10-03T00:00:00.000Z")), { day: "2026-10-03", slot: 0 });
});

test("incrementFor: one counter per category; Idle and unknowns are never stored", () => {
  const t = iso("2026-10-02T09:20:00Z"); // slot 37
  assert.deepEqual(incrementFor(t, "Productive"), { day: "2026-10-02", slot: 37, field: "p", path: "slots.37.p" });
  assert.equal(incrementFor(t, "Neutral").path, "slots.37.n");
  assert.equal(incrementFor(t, "Distraction").path, "slots.37.d");
  assert.equal(incrementFor(t, "Idle"), null);
  assert.equal(incrementFor(t, undefined), null);
  assert.equal(incrementFor(t, "Whatever"), null);
});

test("addSample accumulates the same counters the database $inc would", () => {
  const slots = {};
  const t = iso("2026-10-02T09:20:00Z");
  addSample(slots, t, "Productive");
  addSample(slots, t + 5000, "Productive");
  addSample(slots, t, "Distraction");
  addSample(slots, t, "Idle");
  addSample(slots, t + SLOT_MS, "Neutral");
  assert.deepEqual(slots, { 37: { p: 2, d: 1 }, 38: { n: 1 } });
});

// ---------------------------------------------------------------- the key property
// Oracle: bucket each sample directly by its local date+hour with Intl. Nothing from rollups.
const localHourKey = (tsMs, tz) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(tsMs));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
};

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const CATEGORIES = ["Productive", "Neutral", "Distraction", "Idle"];

// Random samples over [startIso, startIso + days), with random seconds and milliseconds so
// slot edges get hit, plus some forced to sit exactly on a slot boundary.
const makeSamples = (startIso, days, count, seed) => {
  const rand = mulberry32(seed);
  const start = iso(startIso);
  return Array.from({ length: count }, (_, i) => {
    let ts = start + Math.floor(rand() * days * 86400000);
    if (i % 7 === 0) ts = Math.floor(ts / SLOT_MS) * SLOT_MS; // exactly on a boundary
    if (i % 11 === 0) ts = Math.floor(ts / SLOT_MS) * SLOT_MS + SLOT_MS - 1; // last ms of a slot
    return { ts, category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)] };
  });
};

const toDocs = (samples) => {
  const byDay = new Map();
  for (const { ts, category } of samples) {
    const { day } = locate(ts);
    if (!byDay.has(day)) byDay.set(day, {});
    addSample(byDay.get(day), ts, category);
  }
  return [...byDay].map(([day, slots]) => ({ day, slots }));
};

const rawGroups = (samples, tz) => {
  const counts = new Map();
  for (const { ts, category } of samples) {
    if (category === "Idle") continue;
    const key = `${localHourKey(ts, tz)}|${category}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};
const asMap = (groups) => new Map(groups.map((g) => [`${g._id.h}|${g._id.c}`, g.n]));

// Each window straddles at least one DST transition for the zones that have them.
const SCENARIOS = [
  ["UTC", "2026-03-01T00:00:00Z"],
  ["Asia/Kolkata", "2026-09-25T00:00:00Z"], // +5:30, never changes
  ["Asia/Calcutta", "2026-09-25T00:00:00Z"], // the alias browsers actually report
  ["Asia/Kathmandu", "2026-09-25T00:00:00Z"], // +5:45
  ["America/New_York", "2026-03-05T00:00:00Z"], // spring forward 2026-03-08
  ["America/New_York", "2026-10-29T00:00:00Z"], // fall back 2026-11-01
  ["America/Los_Angeles", "2026-03-05T00:00:00Z"],
  ["Europe/London", "2026-10-22T00:00:00Z"], // fall back 2026-10-25
  ["Pacific/Chatham", "2026-09-22T00:00:00Z"], // +12:45 -> +13:45 on 2026-09-27
  ["Pacific/Kiritimati", "2026-09-25T00:00:00Z"], // +14
  ["Australia/Lord_Howe", "2026-10-01T00:00:00Z"], // 30-minute DST shift on 2026-10-04
];

for (const [tz, start] of SCENARIOS) {
  test(`rollups re-bucket exactly like raw samples: ${tz} from ${start.slice(0, 10)}`, () => {
    const samples = makeSamples(start, 14, 6000, tz.length * 1000 + start.length);
    const viaRollups = asMap(groupsFromDocs(toDocs(samples), tz));
    const viaRaw = rawGroups(samples, tz);
    assert.equal(viaRollups.size, viaRaw.size);
    for (const [key, n] of viaRaw) assert.equal(viaRollups.get(key), n, `${key}`);
  });
}

test("the full history built from rollups equals the one built from raw, for every range and zone", () => {
  for (const [tz, start] of [["Asia/Kolkata", "2026-07-01T00:00:00Z"], ["America/New_York", "2026-07-01T00:00:00Z"], ["Pacific/Chatham", "2026-07-01T00:00:00Z"]]) {
    const samples = makeSamples(start, 100, 30000, 99);
    const rawAsGroups = [...rawGroups(samples, tz)].map(([key, n]) => {
      const [h, c] = key.split("|");
      return { _id: { h, c }, n };
    });
    const now = new Date("2026-10-08T10:00:00Z");
    for (const days of [7, 30, 90]) {
      const a = buildHistory(rawAsGroups, { tz, days, now });
      const b = buildHistory(groupsFromDocs(toDocs(samples), tz), { tz, days, now });
      assert.deepEqual(b, a, `${tz} ${days}d`);
    }
  }
});

test("empty or missing slots produce no groups", () => {
  assert.deepEqual(groupsFromDocs([], "UTC"), []);
  assert.deepEqual(groupsFromDocs([{ day: "2026-10-02", slots: {} }], "UTC"), []);
  assert.deepEqual(groupsFromDocs([{ day: "2026-10-02" }], "UTC"), []);
});

// ---------------------------------------------------------------- recordSample (stubbed DB)
test("recordSample: writes the right counter, skips Idle, retries a lost insert race once, marks live once", async () => {
  const writes = [];
  let metaWrites = 0;
  let failFirstWithDuplicate = false;
  DailyStat.collection.updateOne = async (filter, update, options) => {
    writes.push({ filter, update, options });
    if (failFirstWithDuplicate) {
      failFirstWithDuplicate = false;
      const err = new Error("E11000 duplicate key");
      err.code = 11000;
      throw err;
    }
  };
  Meta.collection.updateOne = async () => { metaWrites += 1; };

  const user = "6abf8d446328d75af5e3bfa2";
  const t = new Date("2026-10-02T09:20:00Z");

  await recordSample(user, t, "Idle");
  assert.equal(writes.length, 0, "Idle is never stored");
  assert.equal(metaWrites, 0, "...and doesn't count as the rollups going live");

  await recordSample(user, t, "Productive");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].update, { $inc: { "slots.37.p": 1 } });
  assert.equal(writes[0].filter.day, "2026-10-02");
  assert.equal(String(writes[0].filter.user), user);
  assert.deepEqual(writes[0].options, { upsert: true });

  failFirstWithDuplicate = true;
  await recordSample(user, t, "Distraction");
  assert.equal(writes.length, 3, "the duplicate-key loser retries once as an update");

  assert.equal(metaWrites, 1, "liveSince is recorded once per process, not once per sample");

  DailyStat.collection.updateOne = async () => { throw Object.assign(new Error("disk full"), { code: 8000 }); };
  await assert.rejects(() => recordSample(user, t, "Neutral"), /disk full/, "other errors are not swallowed here (the route decides)");
});

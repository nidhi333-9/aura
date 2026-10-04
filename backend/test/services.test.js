const test = require("node:test");
const assert = require("node:assert/strict");

const { classify } = require("../services/classify");
const { isValidTimeZone, zonedToUtc, localDate } = require("../services/tz");
const {
  buildLive,
  buildHourlyTrend,
  stateFor,
  SENSOR_ONLINE_WITHIN_MS,
} = require("../services/focus");

const iso = (d) => d.toISOString();

// ---------------------------------------------------------------- classify
test("classify: desktop apps, browser sites, unknowns and idle", () => {
  assert.deepEqual(classify("Code", "x"), { site: "VS Code", category: "Productive" });
  assert.deepEqual(classify("Spotify", ""), { site: "Spotify", category: "Neutral" });
  assert.deepEqual(classify("Desktop", ""), { site: "Idle", category: "Idle" });
  assert.deepEqual(classify("Google Chrome", "LeetCode - Two Sum"), {
    site: "LeetCode",
    category: "Productive",
  });
  assert.deepEqual(classify("Safari", "Watching NETFLIX"), {
    site: "Netflix",
    category: "Distraction",
  });
  assert.deepEqual(classify("Firefox", "some blog"), {
    site: "Other website",
    category: "Neutral",
  });
  assert.deepEqual(classify("Slack", "general"), { site: "Slack", category: "Neutral" });
});

test("classify: tolerates a missing title and prototype-like app names", () => {
  assert.deepEqual(classify("Google Chrome", null), { site: "Other website", category: "Neutral" });
  assert.deepEqual(classify("constructor", ""), { site: "constructor", category: "Neutral" });
});

// ---------------------------------------------------------------- tz
test("isValidTimeZone", () => {
  for (const ok of ["UTC", "Asia/Kolkata", "America/New_York"]) assert.equal(isValidTimeZone(ok), true, ok);
  for (const bad of ["Mars/Phobos", "", undefined, null, 5, ["UTC"]]) assert.equal(isValidTimeZone(bad), false, String(bad));
});

test("localDate follows the time zone, not UTC", () => {
  const instant = new Date("2026-10-02T19:30:00Z"); // 01:00 on Oct 3 in India
  assert.deepEqual(localDate(instant, "Asia/Kolkata"), { y: 2026, m: 10, d: 3 });
  assert.deepEqual(localDate(instant, "UTC"), { y: 2026, m: 10, d: 2 });
  assert.deepEqual(localDate(instant, "America/Los_Angeles"), { y: 2026, m: 10, d: 2 });
});

test("zonedToUtc: half-hour offset zone", () => {
  assert.equal(iso(zonedToUtc(2026, 10, 3, 0, "Asia/Kolkata")), "2026-10-02T18:30:00.000Z");
});

test("zonedToUtc: DST days are 23 and 25 hours long", () => {
  const ny = "America/New_York";
  // Spring forward, 2026-03-08
  assert.equal(iso(zonedToUtc(2026, 3, 8, 0, ny)), "2026-03-08T05:00:00.000Z");
  assert.equal(iso(zonedToUtc(2026, 3, 8, 24, ny)), "2026-03-09T04:00:00.000Z");
  // Fall back, 2026-11-01
  assert.equal(iso(zonedToUtc(2026, 11, 1, 0, ny)), "2026-11-01T04:00:00.000Z");
  assert.equal(iso(zonedToUtc(2026, 11, 1, 24, ny)), "2026-11-02T05:00:00.000Z");
});

// ---------------------------------------------------------------- state
test("stateFor thresholds (70 and 40 are exclusive lower bounds)", () => {
  assert.equal(stateFor(null), null);
  assert.equal(stateFor(100).key, "deep_focus");
  assert.equal(stateFor(71).key, "deep_focus");
  assert.equal(stateFor(70).key, "calm_flow");
  assert.equal(stateFor(41).key, "calm_flow");
  assert.equal(stateFor(40).key, "low_energy");
  assert.equal(stateFor(0).key, "low_energy");
});

// ---------------------------------------------------------------- buildLive
const NOW = Date.parse("2026-10-02T12:00:00Z");
const row = (app_name, window_title = "", extra = {}) => ({ app_name, window_title, ...extra });

test("buildLive: score, current app, distribution, top sites (newest first, idle ignored)", () => {
  const rows = [
    row("Desktop"), // newest sample is idle -> must not become current_app
    row("Code"),
    row("Code"),
    row("Code"),
    row("Google Chrome", "Netflix"),
  ];
  const live = buildLive(rows, new Date(NOW - 5000), NOW);
  assert.equal(live.focus_score, 75);
  assert.equal(live.state.key, "deep_focus");
  assert.equal(live.current_app, "VS Code");
  assert.deepEqual(live.app_distribution, { Productive: 3, Neutral: 0, Distraction: 1 });
  assert.deepEqual(live.top_sites, { "VS Code": 3, Netflix: 1 });
  assert.equal(live.total_logs, 4);
});

test("buildLive: stored labels win; rows without labels are classified on the fly", () => {
  const rows = [
    row("Code", "x", { site: "VS Code", category: "Distraction" }), // stored label is authoritative
    row("Code"), // legacy row, no labels -> classified as Productive
  ];
  const live = buildLive(rows, new Date(NOW), NOW);
  assert.deepEqual(live.app_distribution, { Productive: 1, Neutral: 0, Distraction: 1 });
  assert.equal(live.focus_score, 50);
});

test("buildLive: no active samples gives null score/state, not 0", () => {
  const live = buildLive([row("Desktop"), row("Unknown")], new Date(NOW), NOW);
  assert.equal(live.focus_score, null);
  assert.equal(live.state, null);
  assert.equal(live.current_app, null);
  assert.deepEqual(live.top_sites, {});
});

test("buildLive: sensor online flag and last_seen", () => {
  const edge = new Date(NOW - SENSOR_ONLINE_WITHIN_MS);
  assert.equal(buildLive([], edge, NOW).sensor.online, true);
  assert.equal(buildLive([], new Date(NOW - SENSOR_ONLINE_WITHIN_MS - 1), NOW).sensor.online, false);
  assert.deepEqual(buildLive([], null, NOW).sensor, { online: false, last_seen: null, titles_unreadable: false });
  assert.equal(buildLive([], edge, NOW).sensor.last_seen, iso(edge));
});

// ---------------------------------------------------------------- buildHourlyTrend
const at = (isoString, app_name, window_title = "") => ({ timestamp: new Date(isoString), app_name, window_title });

test("buildHourlyTrend: 'today' is the user's local day, not the UTC day", () => {
  const now = new Date("2026-10-02T20:00:00Z"); // 01:30 on Oct 3 in India
  const rows = [
    at("2026-10-02T19:30:00Z", "Code"), // 01:00 IST Oct 3 -> today
    at("2026-10-02T10:00:00Z", "Code"), // 15:30 IST Oct 2 -> yesterday, must be excluded
  ];
  const ist = buildHourlyTrend(rows, "Asia/Kolkata", now);
  assert.equal(ist.length, 24);
  assert.equal(ist[0].time, "2026-10-02T18:30:00.000Z");
  assert.equal(ist[1].score, 100);
  assert.equal(ist.filter((p) => p.score !== null).length, 1);

  const utc = buildHourlyTrend(rows, "UTC", now); // same data, UTC day: both rows count
  assert.equal(utc[19].score, 100);
  assert.equal(utc[10].score, 100);
});

test("buildHourlyTrend: no data is null, idle is ignored, mixed hour is a ratio", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const rows = [
    at("2026-10-02T09:00:00Z", "Code"),
    at("2026-10-02T09:10:00Z", "Code"),
    at("2026-10-02T09:20:00Z", "Code"),
    at("2026-10-02T09:30:00Z", "Google Chrome", "Reddit"),
    at("2026-10-02T09:40:00Z", "Desktop"), // idle: not counted in the ratio
    at("2026-10-02T10:00:00Z", "Desktop"), // hour with only idle -> null
  ];
  const trend = buildHourlyTrend(rows, "UTC", now);
  assert.equal(trend[9].score, 75);
  assert.equal(trend[10].score, null);
  assert.equal(trend[0].score, null);
  assert.equal(trend[23].score, null); // future hour
});

test("buildHourlyTrend: stored category is used when present", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const rows = [{ ...at("2026-10-02T09:00:00Z", "Code"), site: "VS Code", category: "Neutral" }];
  assert.equal(buildHourlyTrend(rows, "UTC", now)[9].score, 0);
});

test("buildHourlyTrend: DST day still yields 24 ordered buckets", () => {
  const trend = buildHourlyTrend([], "America/New_York", new Date("2026-03-08T18:00:00Z"));
  assert.equal(trend.length, 24);
  const times = trend.map((p) => Date.parse(p.time));
  assert.deepEqual([...times].sort((a, b) => a - b), times);
});

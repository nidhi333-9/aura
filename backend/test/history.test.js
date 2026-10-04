const test = require("node:test");
const assert = require("node:assert/strict");

const { buildHistory, windowDates } = require("../services/history");

// Group as MongoDB returns it: samples per (local date+hour, category).
const g = (date, hour, c, n) => ({ _id: { h: `${date}T${String(hour).padStart(2, "0")}`, c }, n });
// A legacy row with no stored category: app/title ride along and are classified in JS.
const legacy = (date, hour, a, t, n) => ({ _id: { h: `${date}T${String(hour).padStart(2, "0")}`, a, t }, n });

const TZ = "Asia/Kolkata";
const NOW = new Date("2026-10-02T09:00:00Z"); // 14:30 on Friday 2 Oct 2026 in India
const by = (list, key, value) => list.find((x) => x[key] === value);

test("7-day window: day stats, counted vs uncounted days, idle/unlabeled/out-of-window rows", () => {
  const groups = [
    // Fri 2 Oct: P 120+60(legacy Code) / N 60 / D 60 -> 300 samples = 50 min, focus 60
    g("2026-10-02", 10, "Productive", 120),
    g("2026-10-02", 10, "Neutral", 60),
    g("2026-10-02", 10, "Distraction", 60),
    legacy("2026-10-02", 10, "Code", "x", 60),
    g("2026-10-02", 3, "Idle", 1000), // idle is ignored entirely
    // Thu 1 Oct: 300 P + 60 D = 60 min, focus 83
    g("2026-10-01", 11, "Productive", 300),
    g("2026-10-01", 11, "Distraction", 60),
    // Wed 30 Sep: only ~3 min tracked at 100%: shown, but must not count
    g("2026-09-30", 9, "Productive", 20),
    // Mon 28 Sep: 60 min, focus 0
    g("2026-09-28", 14, "Neutral", 360),
    // previous period (Tue 22 Sep): 50%
    g("2026-09-22", 10, "Productive", 180),
    g("2026-09-22", 10, "Neutral", 180),
    // far outside the 14-day window
    g("2026-08-01", 10, "Productive", 9999),
  ];
  const h = buildHistory(groups, { tz: TZ, days: 7, now: NOW });

  assert.deepEqual(h.range, { days: 7, from: "2026-09-26", to: "2026-10-02", tz: TZ });
  assert.equal(h.days.length, 7);
  assert.deepEqual(h.days.map((d) => d.dow), [6, 7, 1, 2, 3, 4, 5]); // Sat..Fri, ISO weekdays

  const fri = by(h.days, "date", "2026-10-02");
  assert.equal(fri.focus, 60);
  assert.equal(fri.active_min, 50);
  assert.equal(fri.productive_min, 30);
  assert.equal(fri.neutral_min, 10);
  assert.equal(fri.distraction_min, 10);
  assert.equal(fri.qualifies, true);

  const wed = by(h.days, "date", "2026-09-30");
  assert.equal(wed.focus, 100);
  assert.equal(wed.qualifies, false);
  assert.equal(by(h.days, "date", "2026-09-27").focus, null); // no data -> null, never 0

  const s = h.summary;
  assert.equal(s.tracked_days, 3); // Fri, Thu, Mon (Wed is under 30 min)
  assert.equal(s.avg_focus, 47); // (180+300+0) / (300+360+360) samples, Wed excluded
  assert.equal(s.prev_avg_focus, 50);
  assert.equal(s.delta, -3);
  assert.deepEqual(s.best_day, { date: "2026-10-01", focus: 83, active_min: 60 });
  assert.equal(s.best_weekday, null); // one counted day per weekday is not enough to compare
  assert.equal(s.total_active_min, 173.3); // 1040 samples incl. the uncounted day
  assert.equal(s.total_productive_min, 83.3);
});

test("weekday focus is weighted by tracked time, not a mean of daily scores", () => {
  const groups = [
    // Tuesdays 8, 15, 22 Sep: 100% for 30 min, 0% for 5 h, 100% for 30 min.
    // Mean of daily scores would be 67; weighted by time it is 360/2160 = 17.
    g("2026-09-08", 10, "Productive", 180),
    g("2026-09-15", 10, "Neutral", 1800),
    g("2026-09-22", 10, "Productive", 180),
    // Wednesdays 9, 16, 23 Sep: steady 90%
    g("2026-09-09", 10, "Productive", 540), g("2026-09-09", 10, "Neutral", 60),
    g("2026-09-16", 10, "Productive", 540), g("2026-09-16", 10, "Neutral", 60),
    g("2026-09-23", 10, "Productive", 540), g("2026-09-23", 10, "Neutral", 60),
  ];
  const h = buildHistory(groups, { tz: TZ, days: 30, now: NOW });
  const tue = by(h.by_weekday, "dow", 2);
  const wed = by(h.by_weekday, "dow", 3);
  assert.equal(tue.focus, 17);
  assert.equal(tue.days, 3);
  assert.equal(wed.focus, 90);
  assert.deepEqual(h.summary.best_weekday, { dow: 3, focus: 90, days: 3, active_min: 100 });
  assert.equal(by(h.by_weekday, "dow", 6).focus, null); // Saturday: nothing tracked
});

test("best weekday needs at least two comparable weekdays", () => {
  const groups = ["2026-09-08", "2026-09-15", "2026-09-22"].map((d) => g(d, 10, "Productive", 600));
  const h = buildHistory(groups, { tz: TZ, days: 30, now: NOW });
  assert.equal(by(h.by_weekday, "dow", 2).days, 3);
  assert.equal(h.summary.best_weekday, null); // only Tuesdays qualify: nothing to compare against
});

test("heatmap sums the same weekday+hour across weeks and always has 168 cells", () => {
  const groups = [
    g("2026-09-07", 10, "Productive", 60), g("2026-09-07", 10, "Neutral", 60), // Mon, 50%
    g("2026-09-14", 10, "Productive", 60), // next Monday, 100%
    g("2026-09-08", 3, "Productive", 30), // Tue 03:00, tiny
  ];
  const h = buildHistory(groups, { tz: TZ, days: 30, now: NOW });
  assert.equal(h.heatmap.length, 168);
  const mon10 = h.heatmap.find((c) => c.dow === 1 && c.hour === 10);
  assert.equal(mon10.focus, 67); // 120 / 180 samples
  assert.equal(mon10.active_min, 30);
  const empty = h.heatmap.find((c) => c.dow === 5 && c.hour === 22);
  assert.deepEqual(empty, { dow: 5, hour: 22, focus: null, active_min: 0 });
});

test("peak hour ignores hours with too little tracked time", () => {
  const groups = [
    g("2026-09-07", 3, "Productive", 30), // 100% but only 5 min: not trustworthy
    g("2026-09-07", 10, "Productive", 120), g("2026-09-07", 10, "Neutral", 120), // 50%, 40 min
    g("2026-09-08", 15, "Productive", 180), g("2026-09-08", 15, "Neutral", 60), // 75%, 40 min
  ];
  const h = buildHistory(groups, { tz: TZ, days: 30, now: NOW });
  assert.deepEqual(h.summary.peak_hour, { hour: 15, focus: 75, active_min: 40 });
  const none = buildHistory([g("2026-09-07", 3, "Productive", 30)], { tz: TZ, days: 30, now: NOW });
  assert.equal(none.summary.peak_hour, null);
});

test("no data at all: everything is null/empty, nothing is NaN or 0-as-no-data", () => {
  const h = buildHistory([], { tz: TZ, days: 7, now: NOW });
  assert.equal(h.summary.avg_focus, null);
  assert.equal(h.summary.delta, null);
  assert.equal(h.summary.best_day, null);
  assert.equal(h.summary.tracked_days, 0);
  assert.equal(h.summary.total_active_min, 0);
  assert.ok(h.days.every((d) => d.focus === null && d.qualifies === false));
  assert.ok(h.by_weekday.every((w) => w.focus === null));
});

test("'today' follows the user's time zone", () => {
  const late = new Date("2026-10-02T20:00:00Z"); // already Saturday 3 Oct in India, still Friday in UTC
  assert.equal(buildHistory([], { tz: TZ, days: 7, now: late }).range.to, "2026-10-03");
  assert.equal(buildHistory([], { tz: "UTC", days: 7, now: late }).range.to, "2026-10-02");
});

test("windowDates covers current + previous period and is DST-safe", () => {
  const w = windowDates(7, "America/New_York", new Date("2026-03-09T12:00:00Z")); // day after spring-forward
  assert.deepEqual(w.first, { y: 2026, m: 2, d: 24 });
  assert.deepEqual(w.tomorrow, { y: 2026, m: 3, d: 10 });
  const h = buildHistory([g("2026-03-08", 3, "Productive", 600)], {
    tz: "America/New_York", days: 7, now: new Date("2026-03-09T12:00:00Z"),
  });
  assert.deepEqual(h.range, { days: 7, from: "2026-03-03", to: "2026-03-09", tz: "America/New_York" });
  assert.equal(by(h.days, "date", "2026-03-08").productive_min, 100); // the post-gap hour is counted
});

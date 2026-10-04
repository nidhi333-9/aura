// Scoring for the dashboard. Pure functions over activity rows so they can be tested
// without a database.
//
// Definitions (the one place they live):
//   - Each row is one ~10 s sample of the active window.
//   - "Idle" samples (Desktop/Unknown) are ignored entirely.
//   - focus score = Productive samples / non-idle samples, as a whole percent.
//   - state is derived from the score here, once, so the UI never has its own thresholds.

const { classify, CATEGORIES } = require("./classify");
const { localDate, zonedToUtc } = require("./tz");

const LIVE_WINDOW_MINUTES = 30;
const SENSOR_ONLINE_WITHIN_MS = 60 * 1000; // sensor posts every 10 s; allow a few misses
const TOP_SITES_LIMIT = 10;

const STATES = {
  deep_focus: { key: "deep_focus", label: "Deep Focus" },
  calm_flow: { key: "calm_flow", label: "Calm Flow" },
  low_energy: { key: "low_energy", label: "Low Energy" },
};

const stateFor = (score) => {
  if (score == null) return null;
  if (score > 70) return STATES.deep_focus;
  if (score > 40) return STATES.calm_flow;
  return STATES.low_energy;
};

// Use the label stored at ingest; rows written before that existed (or with an unknown
// category) are classified on the fly so they never silently drop out of the numbers.
const labelOf = (row) =>
  row.site && CATEGORIES.includes(row.category)
    ? { site: row.site, category: row.category }
    : classify(row.app_name, row.window_title);

const percent = (part, whole) => Math.round((part / whole) * 100);

// rows: samples inside the live window, newest first.
// lastSeenAt: timestamp of the newest sample ever stored for the user (any category).
const buildLive = (rows, lastSeenAt, now = Date.now()) => {
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  const sensor = {
    online: lastSeenMs != null && now - lastSeenMs <= SENSOR_ONLINE_WITHIN_MS,
    last_seen: lastSeenMs != null ? new Date(lastSeenMs).toISOString() : null,
  };

  const active = rows
    .map((row) => labelOf(row))
    .filter((label) => label.category !== "Idle");

  const counts = { Productive: 0, Neutral: 0, Distraction: 0 };
  const sites = new Map();
  for (const { site, category } of active) {
    counts[category] += 1;
    sites.set(site, (sites.get(site) || 0) + 1);
  }

  const focusScore = active.length
    ? percent(counts.Productive, active.length)
    : null;

  return {
    focus_score: focusScore,
    state: stateFor(focusScore),
    current_app: active.length ? active[0].site : null,
    top_sites: Object.fromEntries(
      [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_SITES_LIMIT),
    ),
    app_distribution: counts,
    total_logs: active.length,
    window_minutes: LIVE_WINDOW_MINUTES,
    sensor,
  };
};

// 24 hourly buckets for the current calendar day in `tz`. An hour with no (non-idle)
// samples is `null`, not 0, so "no data" is never drawn as "0% focus".
const buildHourlyTrend = (rows, tz, now = new Date()) => {
  const { y, m, d } = localDate(now, tz);
  const starts = Array.from({ length: 25 }, (_, h) =>
    zonedToUtc(y, m, d, h, tz).getTime(),
  );
  const buckets = Array.from({ length: 24 }, () => ({ active: 0, productive: 0 }));

  for (const row of rows) {
    const t = new Date(row.timestamp).getTime();
    if (!(t >= starts[0] && t < starts[24])) continue;
    const { category } = labelOf(row);
    if (category === "Idle") continue;

    let hour = 0;
    while (hour < 23 && t >= starts[hour + 1]) hour += 1;
    buckets[hour].active += 1;
    if (category === "Productive") buckets[hour].productive += 1;
  }

  return buckets.map((b, hour) => ({
    time: new Date(starts[hour]).toISOString(),
    score: b.active ? percent(b.productive, b.active) : null,
  }));
};

module.exports = {
  buildLive,
  buildHourlyTrend,
  stateFor,
  LIVE_WINDOW_MINUTES,
  SENSOR_ONLINE_WITHIN_MS,
};

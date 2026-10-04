// Turns "samples per (local hour, category)" into everything the Week/Month tabs draw.
// Pure functions over pre-aggregated groups, so they can be tested without a database.
//
// Definitions (same meaning of "focus" as services/focus.js):
//   - each sample is ~SAMPLE_SECONDS of activity; Idle samples are ignored
//   - focus % = Productive samples / non-idle samples
//   - a day only COUNTS toward averages, best day and weekday insights if at least
//     MIN_ACTIVE_MINUTES were tracked, so a 2-minute day at 100% can't be "best day"
//   - everything is bucketed by the user's local day/hour (tz), never UTC

const { classify } = require("./classify");
const { localDate } = require("./tz");

const SAMPLE_SECONDS = 10;
const MIN_ACTIVE_MINUTES = 30; // a day below this is shown but not counted
const MIN_WEEKDAY_DAYS = 3; // a weekday needs this many counted days to be compared
const MIN_PEAK_HOUR_MINUTES = 20; // an hour of day needs this much tracked time to be "peak"
const RANGE_DAYS = [7, 30];

const pad = (n) => String(n).padStart(2, "0");
const ymd = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

// Calendar-date arithmetic via UTC so it never depends on the server's own time zone.
const addDays = ({ y, m, d }, n) => {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

// ISO weekday: Monday = 1 ... Sunday = 7
const isoDow = ({ y, m, d }) => {
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
};

const toMinutes = (samples) =>
  Math.round(((samples * SAMPLE_SECONDS) / 60) * 10) / 10;
const percent = (part, whole) => Math.round((part / whole) * 100);
const focusOf = (productive, active) => (active ? percent(productive, active) : null);

// Local midnight bounds for the whole window (current period + the one before it), as
// calendar dates. The route turns these into UTC instants for the query.
const windowDates = (days, tz, now = new Date()) => {
  const today = localDate(now, tz);
  return {
    first: addDays(today, -(days * 2 - 1)),
    tomorrow: addDays(today, 1),
  };
};

// groups: [{ _id: { h: "2026-10-02T14", c?: "Productive", a?: app, t?: title }, n: count }]
//   h  local date + hour (already bucketed in the user's tz by MongoDB)
//   c  stored category; absent on rows written before classify-at-ingest, in which case
//      a/t carry the app/title so they are classified here instead of being dropped
const buildHistory = (groups, { tz, days, now = new Date() }) => {
  const today = localDate(now, tz);
  const dates = Array.from({ length: days * 2 }, (_, i) =>
    addDays(today, i - (days * 2 - 1)),
  ); // oldest first: [previous period..., current period...]

  const slots = new Map(
    dates.map((dt) => [
      ymd(dt),
      Array.from({ length: 24 }, () => ({ p: 0, n: 0, d: 0 })),
    ]),
  );

  for (const g of groups) {
    const [date, hour] = String(g._id.h).split("T");
    const slot = slots.get(date)?.[Number(hour)];
    if (!slot) continue; // outside the window
    const category = g._id.c ?? classify(g._id.a, g._id.t).category;
    if (category === "Idle") continue;
    if (category === "Productive") slot.p += g.n;
    else if (category === "Distraction") slot.d += g.n;
    else slot.n += g.n;
  }

  const dayStats = dates.map((dt) => {
    const hours = slots.get(ymd(dt));
    const sum = hours.reduce(
      (acc, h) => ({ p: acc.p + h.p, n: acc.n + h.n, d: acc.d + h.d }),
      { p: 0, n: 0, d: 0 },
    );
    const active = sum.p + sum.n + sum.d;
    return {
      date: ymd(dt),
      dow: isoDow(dt),
      hours,
      p: sum.p,
      active,
      focus: focusOf(sum.p, active),
      active_min: toMinutes(active),
      productive_min: toMinutes(sum.p),
      neutral_min: toMinutes(sum.n),
      distraction_min: toMinutes(sum.d),
      qualifies: toMinutes(active) >= MIN_ACTIVE_MINUTES,
    };
  });

  const previous = dayStats.slice(0, days);
  const current = dayStats.slice(days);

  const weightedFocus = (list) => {
    const counted = list.filter((d) => d.qualifies);
    const active = counted.reduce((s, d) => s + d.active, 0);
    return focusOf(
      counted.reduce((s, d) => s + d.p, 0),
      active,
    );
  };
  const avgFocus = weightedFocus(current);
  const prevAvgFocus = weightedFocus(previous);

  // --- focus by weekday: weighted by tracked time, counted days only
  const byWeekday = Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1;
    const counted = current.filter((d) => d.dow === dow && d.qualifies);
    const active = counted.reduce((s, d) => s + d.active, 0);
    return {
      dow,
      focus: focusOf(
        counted.reduce((s, d) => s + d.p, 0),
        active,
      ),
      days: counted.length,
      avg_active_min: counted.length ? toMinutes(active / counted.length) : 0,
    };
  });

  // --- hour x weekday heatmap: every tracked sample in the period, counted day or not
  const cells = new Map();
  for (const d of current) {
    d.hours.forEach((h, hour) => {
      const key = `${d.dow}-${hour}`;
      const cell = cells.get(key) || { p: 0, active: 0 };
      cell.p += h.p;
      cell.active += h.p + h.n + h.d;
      cells.set(key, cell);
    });
  }
  const heatmap = [];
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = cells.get(`${dow}-${hour}`) || { p: 0, active: 0 };
      heatmap.push({
        dow,
        hour,
        focus: focusOf(cell.p, cell.active),
        active_min: toMinutes(cell.active),
      });
    }
  }

  // --- summary
  const better = (a, b) =>
    b.focus > a.focus || (b.focus === a.focus && b.active_min > a.active_min) ? b : a;

  const countedDays = current.filter((d) => d.qualifies);
  const bestDay = countedDays.length
    ? countedDays.map((d) => ({ date: d.date, focus: d.focus, active_min: d.active_min })).reduce(better)
    : null;

  const weekdayCandidates = byWeekday.filter((w) => w.days >= MIN_WEEKDAY_DAYS);
  const bestWeekday =
    weekdayCandidates.length >= 2
      ? weekdayCandidates
          .map((w) => ({ dow: w.dow, focus: w.focus, days: w.days, active_min: w.avg_active_min }))
          .reduce(better)
      : null;

  const hourTotals = Array.from({ length: 24 }, () => ({ p: 0, active: 0 }));
  for (const [key, raw] of cells) {
    const hour = Number(key.split("-")[1]);
    hourTotals[hour].p += raw.p;
    hourTotals[hour].active += raw.active;
  }
  const peakCandidates = hourTotals
    .map((h, hour) => ({
      hour,
      focus: focusOf(h.p, h.active),
      active_min: toMinutes(h.active),
    }))
    .filter((h) => h.active_min >= MIN_PEAK_HOUR_MINUTES);
  const peakHour = peakCandidates.length ? peakCandidates.reduce(better) : null;

  const totalActive = current.reduce((s, d) => s + d.active, 0);
  const totalProductive = current.reduce((s, d) => s + d.p, 0);

  return {
    range: {
      days,
      from: current[0].date,
      to: current[current.length - 1].date,
      tz,
    },
    days: current.map(({ hours, p, active, ...day }) => day),
    by_weekday: byWeekday,
    heatmap,
    summary: {
      avg_focus: avgFocus,
      prev_avg_focus: prevAvgFocus,
      delta: avgFocus !== null && prevAvgFocus !== null ? avgFocus - prevAvgFocus : null,
      best_day: bestDay,
      best_weekday: bestWeekday,
      peak_hour: peakHour,
      tracked_days: countedDays.length,
      total_active_min: toMinutes(totalActive),
      total_productive_min: toMinutes(totalProductive),
    },
    meta: {
      sample_seconds: SAMPLE_SECONDS,
      min_active_minutes_per_day: MIN_ACTIVE_MINUTES,
      min_days_per_weekday: MIN_WEEKDAY_DAYS,
    },
  };
};

module.exports = {
  buildHistory,
  windowDates,
  RANGE_DAYS,
  SAMPLE_SECONDS,
  MIN_ACTIVE_MINUTES,
  MIN_WEEKDAY_DAYS,
  MIN_PEAK_HOUR_MINUTES,
};

// Time-zone helpers built on Intl only (no dependency). Used to find "today" and
// hour boundaries in the *user's* time zone instead of assuming UTC.

const isValidTimeZone = (tz) => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Wall-clock parts of `date` as seen in `tz`.
const partsInZone = (date, tz) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
    s: get("second"),
  };
};

// tz offset from UTC (ms) in effect at the instant `date`.
const tzOffsetMs = (date, tz) => {
  const p = partsInZone(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// The UTC instant at which the wall clock in `tz` reads y-m-d h:00. `h` may be 24
// (= next local midnight). The second pass corrects for a DST change between the
// naive guess and the real instant.
const zonedToUtc = (y, m, d, h, tz) => {
  const guess = Date.UTC(y, m - 1, d, h);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc), tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
};

// The calendar date (y, m, d) it currently is in `tz`.
const localDate = (date, tz) => {
  const { y, m, d } = partsInZone(date, tz);
  return { y, m, d };
};

module.exports = { isValidTimeZone, zonedToUtc, localDate, tzOffsetMs };

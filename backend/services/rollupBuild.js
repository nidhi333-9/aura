// Bulk side of the rollups: recompute them from the raw samples, compare with what is stored,
// and work out which days are safe to rebuild. Used by scripts/rebuild-rollups.js and
// scripts/enable-raw-ttl.js; the live path is services/rollups.js.

const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const { classify } = require("./classify");
const { DAY_MS, utcDay, dayStartMs } = require("./rollups");

const FIELD_BY_CATEGORY = { Productive: "p", Neutral: "n", Distraction: "d" };

const key = (user, day) => `${String(user)}|${day}`;

// A slots object with zero counts and empty slots removed, as a stable string, so two documents
// that mean the same thing compare equal however they were produced.
const canonical = (slots = {}) =>
  JSON.stringify(
    Object.keys(slots)
      .map(Number)
      .sort((a, b) => a - b)
      .map((slot) => {
        const f = slots[slot] || {};
        return [slot, f.p || 0, f.n || 0, f.d || 0];
      })
      .filter(([, p, n, d]) => p + n + d > 0),
  );

const totalSamples = (slots = {}) =>
  Object.values(slots).reduce((sum, f) => sum + (f.p || 0) + (f.n || 0) + (f.d || 0), 0);

// Rebuild rollup documents from raw samples in [sinceMs, untilMs) (untilMs optional).
// Returns Map("user|day" -> { user, day, slots }) plus how many raw rows were read.
// One MongoDB aggregation does the heavy lifting: it collapses rows into
// (user, UTC day, 15-minute slot, category) groups, so memory stays small however many rows
// there are. Rows from before classify-at-ingest carry app/title instead of a category and
// are classified here, the same way /api/history treats them.
const computeFromRaw = async ({ sinceMs = 0, untilMs = null } = {}) => {
  const timestamp = { $gte: new Date(sinceMs) };
  if (untilMs !== null) timestamp.$lt = new Date(untilMs);
  const unlabeled = { $in: [{ $type: "$category" }, ["missing", "null"]] };

  const cursor = Activity.collection.aggregate(
    [
      { $match: { timestamp } },
      {
        $group: {
          _id: {
            u: "$user",
            d: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "UTC" } },
            s: {
              $floor: {
                $divide: [
                  { $add: [{ $multiply: [{ $hour: "$timestamp" }, 60] }, { $minute: "$timestamp" }] },
                  15,
                ],
              },
            },
            c: "$category",
            a: { $cond: [unlabeled, "$app_name", "$$REMOVE"] },
            t: { $cond: [unlabeled, "$window_title", "$$REMOVE"] },
          },
          n: { $sum: 1 },
        },
      },
    ],
    { allowDiskUse: true },
  );

  const docs = new Map();
  let rawRows = 0;
  let storedSamples = 0;
  for await (const g of cursor) {
    rawRows += g.n;
    const { u, d, s, c, a, t } = g._id;
    const category = c ?? (a === undefined ? null : classify(a, t).category);
    const field = FIELD_BY_CATEGORY[category]; // Idle / unusable rows are not stored
    if (!field) continue;
    const k = key(u, d);
    if (!docs.has(k)) docs.set(k, { user: u, day: d, slots: {} });
    const slot = (docs.get(k).slots[Number(s)] ||= {});
    slot[field] = (slot[field] || 0) + g.n;
    storedSamples += g.n;
  }
  return { docs, rawRows, storedSamples };
};

// Compare freshly computed rollups with the stored ones for the days in [sinceDay, untilDay)
// (YYYY-MM-DD strings, untilDay exclusive). Pass completed days only: today is still changing.
const compareWithStored = async (computed, { sinceDay, untilDay }) => {
  const stored = await DailyStat.collection
    .find({ day: { $gte: sinceDay, $lt: untilDay } })
    .toArray();
  const storedByKey = new Map(stored.map((doc) => [key(doc.user, doc.day), doc]));

  const missing = [];
  const different = [];
  const extra = [];

  for (const [k, doc] of computed) {
    if (doc.day < sinceDay || doc.day >= untilDay) continue;
    const have = storedByKey.get(k);
    if (!have) {
      missing.push({ k, user: doc.user, day: doc.day, delta: -totalSamples(doc.slots) });
    } else if (canonical(have.slots) !== canonical(doc.slots)) {
      different.push({
        k, _id: have._id, user: doc.user, day: doc.day,
        delta: totalSamples(have.slots) - totalSamples(doc.slots),
      });
    }
  }
  for (const [k, doc] of storedByKey) {
    if (!computed.has(k) && totalSamples(doc.slots) > 0) {
      extra.push({ k, _id: doc._id, user: doc.user, day: doc.day, delta: totalSamples(doc.slots) });
    }
  }
  return { missing, different, extra, ok: !missing.length && !different.length && !extra.length };
};

// The TTL index on raw samples, if one has been enabled (scripts/enable-raw-ttl.js).
const rawTtl = async () => {
  const indexes = await Activity.collection.indexes();
  const ttl = indexes.find(
    (i) => Object.keys(i.key).length === 1 && i.key.timestamp === 1 && i.expireAfterSeconds !== undefined,
  );
  return ttl ? { name: ttl.name, seconds: ttl.expireAfterSeconds } : null;
};

// First UTC day whose raw samples are guaranteed to be complete. With no expiry that is the
// beginning of time. With an expiry, the oldest surviving day is only partly there (the TTL
// has already eaten its early hours), so rebuilding it from raw would silently undercount it
// forever: start the day AFTER the cutoff instead.
const firstCompleteDay = async (nowMs = Date.now()) => {
  const ttl = await rawTtl();
  if (!ttl) return { day: "1970-01-01", ttl: null };
  const cutoffDayStart = dayStartMs(utcDay(nowMs - ttl.seconds * 1000));
  return { day: utcDay(cutoffDayStart + DAY_MS), ttl };
};

const startOfTodayUtc = (nowMs = Date.now()) => utcDay(nowMs);

module.exports = {
  computeFromRaw,
  compareWithStored,
  rawTtl,
  firstCompleteDay,
  startOfTodayUtc,
  totalSamples,
  canonical,
};

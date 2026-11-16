const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const { classify } = require("./classify");
const { DAY_MS, META_ID, utcDay, dayStartMs } = require("./rollups");

const FIELD_BY_CATEGORY = {
  Productive: "p",
  Neutral: "n",
  Distraction: "d",
};

const key = (user, day) => `${String(user)}|${day}`;

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
  Object.values(slots).reduce(
    (sum, f) => sum + (f.p || 0) + (f.n || 0) + (f.d || 0),
    0,
  );

const computeFromRaw = async ({ sinceMs = 0, untilMs = null } = {}) => {
  const timestamp = { $gte: new Date(sinceMs) };
  if (untilMs !== null) timestamp.$lt = new Date(untilMs);

  const unlabeled = {
    $in: [{ $type: "$category" }, ["missing", "null"]],
  };

  const cursor = Activity.collection.aggregate(
    [
      { $match: { timestamp } },
      {
        $group: {
          _id: {
            u: "$user",
            d: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp",
                timezone: "UTC",
              },
            },
            s: {
              $floor: {
                $divide: [
                  {
                    $add: [
                      {
                        $multiply: [{ $hour: "$timestamp" }, 60],
                      },
                      { $minute: "$timestamp" },
                    ],
                  },
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
    const field = FIELD_BY_CATEGORY[category];

    if (!field) continue;

    const k = key(u, d);

    if (!docs.has(k)) {
      docs.set(k, { user: u, day: d, slots: {} });
    }

    const slot = (docs.get(k).slots[Number(s)] ||= {});
    slot[field] = (slot[field] || 0) + g.n;

    storedSamples += g.n;
  }

  return { docs, rawRows, storedSamples };
};

const compareWithStored = async (computed, { sinceDay, untilDay }) => {
  const stored = await DailyStat.collection
    .find({ day: { $gte: sinceDay, $lt: untilDay } })
    .toArray();

  const storedByKey = new Map(
    stored.map((doc) => [key(doc.user, doc.day), doc]),
  );

  const missing = [];
  const different = [];
  const extra = [];

  for (const [k, doc] of computed) {
    if (doc.day < sinceDay || doc.day >= untilDay) continue;

    const have = storedByKey.get(k);

    if (!have) {
      missing.push({
        k,
        user: doc.user,
        day: doc.day,
        delta: -totalSamples(doc.slots),
      });
    } else if (canonical(have.slots) !== canonical(doc.slots)) {
      different.push({
        k,
        _id: have._id,
        user: doc.user,
        day: doc.day,
        delta: totalSamples(have.slots) - totalSamples(doc.slots),
      });
    }
  }

  for (const [k, doc] of storedByKey) {
    if (!computed.has(k) && totalSamples(doc.slots) > 0) {
      extra.push({
        k,
        _id: doc._id,
        user: doc.user,
        day: doc.day,
        delta: totalSamples(doc.slots),
      });
    }
  }

  return {
    missing,
    different,
    extra,
    ok: !missing.length && !different.length && !extra.length,
  };
};

const rawTtl = async () => {
  const indexes = await Activity.collection.indexes();

  const ttl = indexes.find(
    (i) =>
      Object.keys(i.key).length === 1 &&
      i.key.timestamp === 1 &&
      i.expireAfterSeconds !== undefined,
  );

  return ttl ? { name: ttl.name, seconds: ttl.expireAfterSeconds } : null;
};

const firstCompleteDay = async (nowMs = Date.now()) => {
  const ttl = await rawTtl();

  const [oldest] = await Activity.collection
    .find({}, { projection: { timestamp: 1 } })
    .sort({ timestamp: 1 })
    .limit(1)
    .toArray();

  let day = "1970-01-01";

  const later = (candidate) => {
    if (candidate > day) day = candidate;
  };

  if (ttl) {
    later(utcDay(dayStartMs(utcDay(nowMs - ttl.seconds * 1000)) + DAY_MS));
  }

  if (!oldest) {
    if (
      ttl ||
      (await DailyStat.collection.findOne({}, { projection: { _id: 1 } }))
    ) {
      later(utcDay(nowMs));
    }
  } else {
    const oldestDay = utcDay(new Date(oldest.timestamp).getTime());

    const marker = await Meta.collection.findOne(
      { _id: META_ID },
      { projection: { rawExpiryEnabledAt: 1 } },
    );

    const expired =
      ttl ||
      marker?.rawExpiryEnabledAt ||
      (await DailyStat.collection.findOne(
        { day: { $lt: oldestDay } },
        { projection: { _id: 1 } },
      ));

    if (expired) {
      later(utcDay(dayStartMs(oldestDay) + DAY_MS));
    }
  }

  return { day, ttl };
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

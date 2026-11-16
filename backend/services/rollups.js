const mongoose = require("mongoose");
const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const { tzOffsetMs } = require("./tz");

const SLOT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const META_ID = "rollups";

const FIELD_BY_CATEGORY = {
  Productive: "p",
  Neutral: "n",
  Distraction: "d",
};

const CATEGORY_BY_FIELD = {
  p: "Productive",
  n: "Neutral",
  d: "Distraction",
};

const pad = (n) => String(n).padStart(2, "0");

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const dayStartMs = (day) => Date.parse(`${day}T00:00:00Z`);

const locate = (tsMs) => {
  const day = utcDay(tsMs);
  return {
    day,
    slot: Math.floor((tsMs - dayStartMs(day)) / SLOT_MS),
  };
};

const incrementFor = (tsMs, category) => {
  const field = FIELD_BY_CATEGORY[category];
  if (!field) return null;

  const { day, slot } = locate(tsMs);

  return {
    day,
    slot,
    field,
    path: `slots.${slot}.${field}`,
  };
};

const addSample = (slots, tsMs, category) => {
  const inc = incrementFor(tsMs, category);
  if (!inc) return;

  const slot = (slots[inc.slot] ||= {});
  slot[inc.field] = (slot[inc.field] || 0) + 1;
};

const groupsFromDocs = (docs, tz) => {
  const counts = new Map();

  for (const doc of docs) {
    const start = dayStartMs(doc.day);
    const offsetAtStart = tzOffsetMs(new Date(start), tz);
    const offsetAtEnd = tzOffsetMs(new Date(start + DAY_MS - 1000), tz);

    for (const [slotKey, fields] of Object.entries(doc.slots || {})) {
      const slotMs = start + Number(slotKey) * SLOT_MS;

      const offset =
        offsetAtStart === offsetAtEnd
          ? offsetAtStart
          : tzOffsetMs(new Date(slotMs), tz);

      const local = new Date(slotMs + offset);

      const hour = `${local.getUTCFullYear()}-${pad(
        local.getUTCMonth() + 1,
      )}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}`;

      for (const field of Object.keys(CATEGORY_BY_FIELD)) {
        const n = fields[field];
        if (!n) continue;

        const key = `${hour}|${CATEGORY_BY_FIELD[field]}`;
        counts.set(key, (counts.get(key) || 0) + n);
      }
    }
  }

  return [...counts].map(([key, n]) => {
    const [h, c] = key.split("|");
    return { _id: { h, c }, n };
  });
};

const docsForRange = (userId, fromMs, toMs) =>
  DailyStat.find({
    user: userId,
    day: { $gte: utcDay(fromMs), $lte: utcDay(toMs - 1) },
  }).lean();

const rollupsReady = async () => {
  const meta = await Meta.collection.findOne({ _id: META_ID });
  return !!meta?.ready;
};

let liveMarked = false;

const markLive = async () => {
  if (liveMarked) return;

  await Meta.collection.updateOne(
    { _id: META_ID },
    { $min: { liveSince: new Date() } },
    { upsert: true },
  );

  liveMarked = true;
};

const recordSample = async (userId, timestamp, category) => {
  const inc = incrementFor(timestamp.getTime(), category);
  if (!inc) return;

  const filter = {
    user: new mongoose.Types.ObjectId(userId),
    day: inc.day,
  };

  const update = { $inc: { [inc.path]: 1 } };

  try {
    await DailyStat.collection.updateOne(filter, update, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;

    await DailyStat.collection.updateOne(filter, update, { upsert: true });
  }

  await markLive();
};

module.exports = {
  SLOT_MS,
  DAY_MS,
  META_ID,
  utcDay,
  dayStartMs,
  locate,
  incrementFor,
  addSample,
  groupsFromDocs,
  docsForRange,
  rollupsReady,
  recordSample,
};

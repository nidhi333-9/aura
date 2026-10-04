// Daily rollups: a compact, permanent summary of the raw samples (see models/DailyStat.js).
//
//   ingest       raw row inserted, then recordSample() bumps one counter in the day's document
//   /api/history groupsFromDocs() re-buckets those counters into the viewer's local hours and
//                hands them to buildHistory(), the same function the raw-data path feeds
//
// Why 15-minute slots: a sample's local hour depends on the viewer's time zone, and every real
// zone's UTC offset is a multiple of 15 minutes. So a 15-minute UTC slot never straddles a local
// hour boundary, and one set of rollups serves every zone exactly (IST's +5:30, Nepal's +5:45,
// Chatham's +12:45 included), with no need to know the zone at write time.

const mongoose = require("mongoose");
const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const { tzOffsetMs } = require("./tz");

const SLOT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const META_ID = "rollups";

const FIELD_BY_CATEGORY = { Productive: "p", Neutral: "n", Distraction: "d" };
const CATEGORY_BY_FIELD = { p: "Productive", n: "Neutral", d: "Distraction" };

const pad = (n) => String(n).padStart(2, "0");
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10); // "2026-10-02"
const dayStartMs = (day) => Date.parse(`${day}T00:00:00Z`);

// Which UTC day and 15-minute slot (0..95) a sample belongs to.
const locate = (tsMs) => {
  const day = utcDay(tsMs);
  return { day, slot: Math.floor((tsMs - dayStartMs(day)) / SLOT_MS) };
};

// The counter a sample increments, or null for samples that are not stored (Idle).
const incrementFor = (tsMs, category) => {
  const field = FIELD_BY_CATEGORY[category];
  if (!field) return null;
  const { day, slot } = locate(tsMs);
  return { day, slot, field, path: `slots.${slot}.${field}` };
};

// In-memory twin of what recordSample does to the database. Used to build rollups from raw
// rows in bulk and by the tests; it must stay in lockstep with incrementFor.
const addSample = (slots, tsMs, category) => {
  const inc = incrementFor(tsMs, category);
  if (!inc) return;
  const slot = (slots[inc.slot] ||= {});
  slot[inc.field] = (slot[inc.field] || 0) + 1;
};

// --- reading ---------------------------------------------------------------------------

// Turn rollup documents into the {_id: {h: "YYYY-MM-DDTHH", c}, n} groups buildHistory wants,
// with h in `tz`. The offset is looked up per day (two Intl calls), and per slot only on the
// rare day a DST change falls inside it.
const groupsFromDocs = (docs, tz) => {
  const counts = new Map();
  for (const doc of docs) {
    const start = dayStartMs(doc.day);
    const offsetAtStart = tzOffsetMs(new Date(start), tz);
    const offsetAtEnd = tzOffsetMs(new Date(start + DAY_MS - 1000), tz);
    for (const [slotKey, fields] of Object.entries(doc.slots || {})) {
      const slotMs = start + Number(slotKey) * SLOT_MS;
      const offset =
        offsetAtStart === offsetAtEnd ? offsetAtStart : tzOffsetMs(new Date(slotMs), tz);
      const local = new Date(slotMs + offset); // read the UTC fields as the local wall clock
      const hour = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}`;
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

// Rollup documents that can hold samples in the half-open range [fromMs, toMs).
const docsForRange = (userId, fromMs, toMs) =>
  DailyStat.find({
    user: userId,
    day: { $gte: utcDay(fromMs), $lte: utcDay(toMs - 1) },
  }).lean();

const rollupsReady = async () => {
  const meta = await Meta.collection.findOne({ _id: META_ID });
  return !!meta?.ready;
};

// --- writing ---------------------------------------------------------------------------

let liveMarked = false;
const markLive = async () => {
  if (liveMarked) return;
  // $min: the earliest moment any backend instance started writing rollups.
  await Meta.collection.updateOne(
    { _id: META_ID },
    { $min: { liveSince: new Date() } },
    { upsert: true },
  );
  liveMarked = true;
};

// Count one sample in its day's document. Safe to call concurrently: $inc is atomic, and if two
// requests both try to create a brand-new day, the loser hits the unique index and just retries
// as an update.
const recordSample = async (userId, timestamp, category) => {
  const inc = incrementFor(timestamp.getTime(), category);
  if (!inc) return;
  const filter = { user: new mongoose.Types.ObjectId(userId), day: inc.day };
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

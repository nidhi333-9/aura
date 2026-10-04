// Makes raw activity samples expire after N days (default 30) while the daily rollups, which
// are all the history charts need, are kept forever. This is the ONLY thing in the project that
// deletes data, so it refuses to act unless the rollups provably contain everything that is
// about to expire.
//
//   node scripts/enable-raw-ttl.js                  dry run: run every check, change nothing
//   node scripts/enable-raw-ttl.js --days 30 --apply   enable expiry
//   node scripts/enable-raw-ttl.js --disable --apply   stop expiring (deleted rows are not restored)
//
// Before running it for real:
//   * rollups must be built and verified:  node scripts/rebuild-rollups.js --apply
//   * save a backup of the whole database to this computer:  node scripts/backup.js
//     (free Atlas clusters usually can't take snapshots; a paid tier's Backup > Take Snapshot Now also works)
//   * if you want old window titles for ML labelling, run ml-service/training/build_dataset.py
//     first: after this, titles older than N days no longer exist
// MongoDB's TTL monitor deletes in the background roughly once a minute, starting right after
// --apply.

require("../config/env")(); // .env.local > .env
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const Meta = require("../models/Meta");
const { META_ID } = require("../services/rollups");
const {
  computeFromRaw,
  compareWithStored,
  firstCompleteDay,
  rawTtl,
  startOfTodayUtc,
} = require("../services/rollupBuild");

const TTL_INDEX_NAME = "timestamp_ttl";
const MIN_DAYS = 7; // a typo like --days 0 must not be able to wipe the collection
const apply = process.argv.includes("--apply");
const disable = process.argv.includes("--disable");
const daysIdx = process.argv.indexOf("--days");
const days = daysIdx > -1 ? Number(process.argv[daysIdx + 1]) : 30;

const fail = (message) => {
  console.error(`\nREFUSING: ${message}`);
  return process.exit(1);
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    return process.exit(1);
  }
  if (!disable && !(days >= MIN_DAYS)) {
    return fail(`--days must be a number of at least ${MIN_DAYS}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
  console.log(apply ? "Mode: APPLY" : "Mode: dry run (nothing will be changed; add --apply to act)");

  const current = await rawTtl();
  console.log(
    current
      ? `Raw samples currently expire after ${Math.round(current.seconds / 86400)} days (index "${current.name}").`
      : "Raw samples currently never expire.",
  );

  if (disable) {
    if (!current) {
      console.log("Nothing to disable.");
      return process.exit(0);
    }
    if (apply) {
      await Activity.collection.dropIndex(current.name);
      console.log(`Dropped "${current.name}". Raw samples no longer expire. (Rows already deleted stay deleted.)`);
    } else {
      console.log(`Dry run: --apply would drop "${current.name}".`);
    }
    return process.exit(0);
  }

  // Gate 1: the rollups must have been built and verified by rebuild-rollups.js.
  const meta = await Meta.collection.findOne({ _id: META_ID });
  if (!meta?.ready) {
    return fail("the rollups are not marked ready. Run `node scripts/rebuild-rollups.js --apply` first.");
  }
  console.log(`Rollups are marked ready (built ${meta.builtAt?.toISOString() ?? "at an unknown time"}).`);

  // Gate 2: do not trust that flag alone. Recompute from the raw samples right now and demand an
  // exact match, for every completed day whose raw samples are still fully present.
  const now = Date.now();
  const { day: sinceDay } = await firstCompleteDay(now);
  const today = startOfTodayUtc(now);
  const raw = await computeFromRaw({ sinceMs: 0, untilMs: Date.parse(`${today}T00:00:00Z`) });
  const cmp = await compareWithStored(raw.docs, { sinceDay, untilDay: today });
  if (!cmp.ok) {
    const n = cmp.missing.length + cmp.different.length + cmp.extra.length;
    const e = [...cmp.missing, ...cmp.different, ...cmp.extra].slice(0, 5).map((x) => x.day).join(", ");
    return fail(`${n} user-day rollup(s) do not match the raw samples (e.g. ${e}). Run \`node scripts/rebuild-rollups.js --apply\`, then try again.`);
  }
  console.log(`Verified: the rollups match the raw samples exactly for ${raw.docs.size} user-day(s) (${raw.rawRows} samples).`);

  // What would actually go.
  const cutoff = new Date(now - days * 86400000);
  const [total, expiring, oldest] = await Promise.all([
    Activity.collection.estimatedDocumentCount(),
    Activity.collection.countDocuments({ timestamp: { $lt: cutoff } }),
    Activity.collection.find({}, { projection: { timestamp: 1 } }).sort({ timestamp: 1 }).limit(1).toArray(),
  ]);
  console.log(`\nRaw samples now: ${total}. Older than ${days} days (before ${cutoff.toISOString().slice(0, 10)}): ${expiring} would be deleted.`);
  if (oldest[0]) console.log(`Oldest raw sample: ${oldest[0].timestamp.toISOString().slice(0, 10)}.`);
  console.log("Kept forever: the daily rollups, so every history chart keeps working for those days.");
  console.log("Lost for good: the individual samples and their window titles older than that.");

  if (!apply) {
    console.log("\nDry run: all checks passed. Take a backup, then re-run with --apply to enable expiry.");
    return process.exit(0);
  }

  const seconds = Math.round(days * 86400);
  try {
    await Activity.collection.createIndex({ timestamp: 1 }, { expireAfterSeconds: seconds, name: TTL_INDEX_NAME });
  } catch (err) {
    // 85/86: an index on timestamp already exists with different options (another TTL, or a
    // plain one). collMod changes it in place.
    if (err.code !== 85 && err.code !== 86) throw err;
    await mongoose.connection.db.command({
      collMod: Activity.collection.collectionName,
      index: { keyPattern: { timestamp: 1 }, expireAfterSeconds: seconds },
    });
  }
  // Remember that expiry was switched on, even if the rule is later removed or changed: the rows
  // it deleted stay deleted, and rebuild-rollups.js must never try to recompute those days.
  await Meta.collection.updateOne(
    { _id: META_ID },
    { $set: { rawExpiryEnabledAt: new Date() } },
    { upsert: true },
  );
  console.log(`\nENABLED: raw samples older than ${days} days now expire. Deletion starts within about a minute.`);
  console.log("To stop: node scripts/enable-raw-ttl.js --disable --apply");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

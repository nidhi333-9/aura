// Builds (or repairs) the daily rollups from the raw samples, verifies them, and, only when
// that succeeds, tells /api/history it may read from them instead of from raw data.
//
//   node scripts/rebuild-rollups.js                dry run: what would change, nothing written
//   node scripts/rebuild-rollups.js --apply        rebuild everything, verify, mark ready
//   node scripts/rebuild-rollups.js --apply --days 3   repair just the last 3 days (never marks ready)
//   node scripts/rebuild-rollups.js --apply --disable  make /api/history read raw data again
//
// Run it AFTER deploying the backend that writes rollups at ingest (it checks), and again after
// anything that changes categories of existing rows (backfill-classification --force).
// Safe to re-run: it recomputes days from raw and replaces them, it never adds to them.

require("../config/env")(); // .env.local > .env
const mongoose = require("mongoose");
const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const { DAY_MS, META_ID, utcDay, dayStartMs } = require("../services/rollups");
const {
  computeFromRaw,
  compareWithStored,
  firstCompleteDay,
  startOfTodayUtc,
} = require("../services/rollupBuild");

const BATCH = 1000;
const apply = process.argv.includes("--apply");
const disable = process.argv.includes("--disable");
const daysIdx = process.argv.indexOf("--days");
const daysArg = daysIdx > -1 ? Number(process.argv[daysIdx + 1]) : null;

const describe = (cmp) => {
  const lines = [];
  for (const [label, list] of [["missing", cmp.missing], ["different", cmp.different], ["stale/extra", cmp.extra]]) {
    if (!list.length) continue;
    lines.push(`  ${label}: ${list.length} user-day(s), e.g. ${list.slice(0, 3).map((x) => `${x.day} (${x.delta > 0 ? "+" : ""}${x.delta} samples)`).join(", ")}`);
  }
  return lines.length ? lines.join("\n") : "  none: rollups match the raw samples exactly";
};

const writeDocs = async (docs) => {
  const ops = [...docs.values()].map((doc) => ({
    replaceOne: {
      filter: { user: doc.user, day: doc.day },
      replacement: { user: doc.user, day: doc.day, slots: doc.slots },
      upsert: true,
    },
  }));
  for (let i = 0; i < ops.length; i += BATCH) {
    await DailyStat.collection.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
  }
  return ops.length;
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    return process.exit(1);
  }
  if (daysArg !== null && !(daysArg >= 1)) {
    console.error("--days needs a number of at least 1");
    return process.exit(1);
  }

  const startedAt = Date.now();
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
  console.log(apply ? "Mode: APPLY" : "Mode: dry run (nothing will be written; add --apply to write)");

  if (disable) {
    console.log("\nMaking /api/history read the raw samples again (rollups are kept).");
    if (apply) {
      await Meta.collection.updateOne({ _id: META_ID }, { $set: { ready: false } }, { upsert: true });
      console.log("Done. /api/history now uses raw data (90-day range is unavailable until you re-enable rollups).");
    } else {
      console.log("Dry run: re-run with --apply to do it.");
    }
    return process.exit(0);
  }

  // Which days can be rebuilt from raw? All of them, unless raw samples expire: then the oldest
  // surviving day is only partly there and must be left alone.
  const { day: safeDay, ttl } = await firstCompleteDay(startedAt);
  let sinceDay = safeDay;
  if (daysArg !== null) {
    const requested = utcDay(startedAt - daysArg * DAY_MS);
    if (requested > sinceDay) sinceDay = requested;
  }
  const today = startOfTodayUtc(startedAt);
  const todayMs = dayStartMs(today);
  console.log(
    `Range: ${sinceDay === "1970-01-01" ? "all raw samples" : `from ${sinceDay}`} up to and including today (${today})`,
  );
  if (safeDay !== "1970-01-01") {
    console.log(
      `Raw samples ${ttl ? `expire after ${Math.round(ttl.seconds / 86400)} days` : "have expired"}; days before ${safeDay} are summary-only and are never touched here.`,
    );
  }

  // Pass 1: completed days (these no longer change, so there is no race with live ingest).
  const sinceMs = dayStartMs(sinceDay);
  const completed = await computeFromRaw({ sinceMs, untilMs: todayMs });
  console.log(`\nRead ${completed.rawRows} raw samples from completed days -> ${completed.docs.size} user-day rollups.`);
  const cmp = await compareWithStored(completed.docs, { sinceDay, untilDay: today });
  console.log("Compared with the stored rollups for completed days:");
  console.log(describe(cmp));

  if (!apply) {
    const fix = cmp.missing.length + cmp.different.length + cmp.extra.length;
    console.log(fix ? `\nDry run: --apply would write ${completed.docs.size} rollups and fix ${fix} of them.` : "\nDry run: nothing needs fixing.");
    return process.exit(0);
  }

  const written = await writeDocs(completed.docs);
  if (cmp.extra.length) {
    await DailyStat.collection.deleteMany({ _id: { $in: cmp.extra.map((x) => x._id) } });
  }
  console.log(`\nWrote ${written} rollups for completed days${cmp.extra.length ? `, removed ${cmp.extra.length} stale ones` : ""}.`);

  // Pass 2: today, done last and on its own so the gap between "read raw" and "write rollup"
  // (during which a live sample could be missed) is about a second, not the length of pass 1.
  const todayPass = await computeFromRaw({ sinceMs: todayMs });
  await writeDocs(todayPass.docs);
  console.log(`Refreshed today's rollups (${todayPass.docs.size} user-day(s), ${todayPass.rawRows} samples).`);

  // Verify what is now stored against a fresh read of raw, completed days only.
  const again = await computeFromRaw({ sinceMs, untilMs: todayMs });
  const verify = await compareWithStored(again.docs, { sinceDay, untilDay: today });
  console.log("\nVerification (fresh read of raw vs stored, completed days):");
  console.log(describe(verify));
  if (!verify.ok) {
    console.error("\nVerification FAILED: not marking the rollups as ready. Re-run, and check the output above.");
    return process.exit(1);
  }

  if (daysArg !== null) {
    console.log("\nPartial repair (--days): readiness unchanged.");
    return process.exit(0);
  }

  // Ready only if the backend was already writing rollups when this run began: otherwise a
  // sample could have arrived between "backfill read it" and "ingest started counting it".
  const meta = await Meta.collection.findOne({ _id: META_ID });
  if (!meta?.liveSince) {
    console.log("\nNOT marking ready: no rollup has been written at ingest yet.");
    console.log("Deploy the backend that writes rollups, wait for one sensor sample, then run this again.");
    return process.exit(0);
  }
  if (meta.liveSince.getTime() > startedAt) {
    console.log(`\nNOT marking ready: the backend only started writing rollups at ${meta.liveSince.toISOString()}, after this run began.`);
    console.log("Run this again now; it will then cover the gap.");
    return process.exit(0);
  }

  await Meta.collection.updateOne(
    { _id: META_ID },
    { $set: { ready: true, builtAt: new Date() } },
    { upsert: true },
  );
  console.log("\nREADY: /api/history now reads from the rollups (this applies immediately; no restart needed).");
  console.log("The 3-month range is available. Raw samples are untouched; nothing has been deleted.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Rebuild failed:", err);
  process.exit(1);
});

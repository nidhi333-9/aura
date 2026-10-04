// Labels existing activity rows with { site, category }: what POST /api/log-activity now
// does for every new row. Run it once after deploying the classify-at-ingest change.
//
//   node scripts/backfill-classification.js                  dry run: shows what would change
//   node scripts/backfill-classification.js --apply          writes the labels
//   node scripts/backfill-classification.js --apply --force  relabels EVERY row (after editing a rule)
//
// Safe to re-run: without --force it only touches rows that are missing a label.

require("../config/env")(); // .env.local > .env
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const { classify } = require("../services/classify");

const BATCH_SIZE = 1000;
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    return process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const { host, name } = mongoose.connection;
  console.log(`Database: ${name} on ${host}`);
  console.log(
    apply
      ? `Mode: APPLY${force ? " (force: relabel every row)" : " (only rows missing a label)"}`
      : "Mode: dry run (nothing will be written; add --apply to write)",
  );

  const filter = force
    ? {}
    : { $or: [{ site: { $exists: false } }, { category: { $exists: false } }] };
  const total = await Activity.collection.countDocuments(filter);
  console.log(`Rows to label: ${total}`);
  if (total === 0) {
    console.log("Nothing to do.");
    return process.exit(0);
  }

  // Native driver on purpose: no per-document casting overhead for a one-off job.
  const cursor = Activity.collection
    .find(filter, { projection: { app_name: 1, window_title: 1 } })
    .sort({ _id: 1 });

  const byCategory = {};
  let ops = [];
  let seen = 0;
  let written = 0;
  let skipped = 0;

  const flush = async () => {
    if (!ops.length) return;
    if (apply) {
      const result = await Activity.collection.bulkWrite(ops, { ordered: false });
      written += result.modifiedCount;
    }
    ops = [];
  };

  for await (const doc of cursor) {
    seen += 1;
    if (typeof doc.app_name !== "string" || !doc.app_name) {
      skipped += 1;
      continue;
    }
    const { site, category } = classify(doc.app_name, doc.window_title);
    byCategory[category] = (byCategory[category] || 0) + 1;
    ops.push({
      updateOne: { filter: { _id: doc._id }, update: { $set: { site, category } } },
    });
    if (ops.length >= BATCH_SIZE) await flush();
    if (seen % 50000 === 0) console.log(`  ...${seen}/${total}`);
  }
  await flush();

  console.log(`Scanned ${seen} rows${skipped ? `, skipped ${skipped} without an app_name` : ""}.`);
  console.log("Category breakdown:", byCategory);
  console.log(apply ? `Updated ${written} rows.` : "Dry run only. Re-run with --apply to write.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

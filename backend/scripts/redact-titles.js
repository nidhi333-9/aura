// Hides login tokens and one-time codes in the window titles that are ALREADY stored: what
// POST /api/log-activity now does for every new sample (services/privacy.js). Run it once after
// deploying that change.
//
//   node scripts/redact-titles.js           dry run: counts what would change, writes nothing
//   node scripts/redact-titles.js --apply   rewrites those titles
//
// Only window_title is touched, and only on rows where the cleaner actually changes it. Ordinary
// titles are never rewritten. Safe to re-run. It never prints the original text (that is the
// secret); it shows the cleaned version of a few titles so you can see what the change looks like.

require("../config/env")(); // .env.local > .env
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const { redactTitle } = require("../services/privacy");

const BATCH_SIZE = 500;
const EXAMPLES = 5;
const apply = process.argv.includes("--apply");

// A cheap first filter inside MongoDB; redactTitle() makes the real decision per title.
const CANDIDATES = { window_title: { $regex: "[?#]\\S|eyJ|[;&]\\w+=" } };

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    return process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
  console.log(apply ? "Mode: APPLY" : "Mode: dry run (nothing will be written; add --apply to write)");

  const total = await Activity.collection.estimatedDocumentCount();
  const cursor = Activity.collection
    .find(CANDIDATES, { projection: { window_title: 1 } })
    .sort({ _id: 1 });

  let looked = 0;
  let changed = 0;
  let written = 0;
  const examples = new Set();
  let ops = [];

  const flush = async () => {
    if (!ops.length) return;
    if (apply) {
      const result = await Activity.collection.bulkWrite(ops, { ordered: false });
      written += result.modifiedCount;
    }
    ops = [];
  };

  for await (const doc of cursor) {
    looked += 1;
    if (typeof doc.window_title !== "string") continue;
    const cleaned = redactTitle(doc.window_title);
    if (cleaned === doc.window_title) continue;
    changed += 1;
    if (examples.size < EXAMPLES) examples.add(cleaned.slice(0, 120));
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { window_title: cleaned } } } });
    if (ops.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`\nSamples in total: ${total}`);
  console.log(`Titles that looked worth checking: ${looked}`);
  console.log(`Titles that contain a secret and ${apply ? "were" : "would be"} cleaned: ${changed}`);
  if (examples.size) {
    console.log("\nWhat they look like after cleaning (the originals are not shown on purpose):");
    for (const e of examples) console.log(`  ${e}`);
  }
  console.log(
    apply
      ? `\nUpdated ${written} samples.`
      : changed
        ? "\nDry run only. Re-run with --apply to write."
        : "\nNothing to clean.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Redaction failed:", err);
  process.exit(1);
});

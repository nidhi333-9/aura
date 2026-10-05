// Saves a full copy of the database to a folder on THIS computer, using MongoDB's own `mongodump`
// (install: `brew install mongodb-database-tools`). Free Atlas clusters usually can't take
// snapshots, so this is the safety net before anything that deletes data (scripts/enable-raw-ttl.js).
//
//   node scripts/backup.js                   saves to ~/aura-backups/<database>-<date and time>/
//   node scripts/backup.js --out ~/somewhere saves under another folder
//   node scripts/backup.js --keep 12         afterwards, deletes the OLDER backups so only the newest 12
//                                            remain (only folders this script made, only after this
//                                            backup succeeded)
//   node scripts/backup.js --min-age-days 6  does nothing when the newest backup is younger than 6 days
//
// scripts/schedule-backup.sh runs it every evening with both options, which makes a backup about
// weekly and, because a missed or failed night is simply tried again the next night, never skips a week.
//
// It only READS the database. The copy contains everyone's activity, including window titles, so it
// refuses to save anywhere inside the project folder (it must never be committed), and the folder
// is private to your user. The database password is never printed.

require("../config/env")(); // .env.local > .env
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describeMongoTarget } = require("../config/mongoTarget");
const { selectBackupsToDelete, parseKeepOption, parseMinAgeOption, newestBackupAgeDays } = require("../services/backupFiles");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const fail = (message) => {
  console.error(`\nREFUSING: ${message}`);
  process.exit(1);
};

const sizeOf = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size);
  }, 0);

const outIdx = process.argv.indexOf("--out");
const base = path.resolve(outIdx > -1 ? process.argv[outIdx + 1] || "" : path.join(os.homedir(), "aura-backups"));

if (!process.env.MONGO_URI) fail("MONGO_URI is not set");
if (base === REPO_ROOT || base.startsWith(REPO_ROOT + path.sep)) {
  fail(`${base} is inside the project folder. A backup holds personal data and must never be committed; choose a folder elsewhere.`);
}

const target = describeMongoTarget(process.env.MONGO_URI);
if (!target.db) fail("the database name is missing from MONGO_URI, so it is unclear what to back up");

let keep = null;
let minAgeDays = null;
try {
  keep = parseKeepOption(process.argv); // checked first: a typo must stop the run before anything happens
  minAgeDays = parseMinAgeOption(process.argv);
} catch (err) {
  fail(err.message);
}

if (minAgeDays !== null && fs.existsSync(base)) {
  const names = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const age = newestBackupAgeDays(names, target.db);
  if (age !== null && age < minAgeDays) {
    console.log(`[${new Date().toISOString()}] the newest backup is ${age.toFixed(1)} day(s) old, younger than ${minAgeDays}: nothing to do`);
    process.exit(0);
  }
}

console.log(`[${new Date().toISOString()}] backup starting`);

// AURA_BACKUP_STAMP only exists so the tests can make two runs collide on purpose.
const stamp = process.env.AURA_BACKUP_STAMP || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(base, `${target.db}-${stamp}`);
fs.mkdirSync(base, { recursive: true, mode: 0o700 });
fs.chmodSync(base, 0o700);
try {
  // Not recursive on purpose: it must FAIL if the folder is already there. The cleanup below may only
  // ever delete a folder this run created itself, never a good backup that has the same name.
  fs.mkdirSync(dir, { mode: 0o700 });
} catch (err) {
  if (err.code === "EEXIST") fail(`${dir} already exists (two runs in the same second?). Nothing was changed. Wait a moment and run it again.`);
  throw err;
}
fs.chmodSync(dir, 0o700);

// A failed attempt must not leave a half-made folder behind: it would look like a real backup and
// could, over several failed runs, push good ones out when old backups are removed (--keep).
const discardAndFail = (message) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fail(message);
};

console.log(`Backing up ${target.kind === "remote" ? "the REMOTE" : "a local"} database "${target.db}" to:\n  ${dir}\n`);

// A copy of this database takes seconds. If it takes much longer the network is down or stuck, and
// waiting forever would also stop tomorrow's scheduled attempt from starting.
const DUMP_TIMEOUT_MS = Number(process.env.AURA_BACKUP_TIMEOUT_MS) || 10 * 60 * 1000; // the override is for tests
const run = spawnSync("mongodump", ["--uri", process.env.MONGO_URI, "--gzip", "--out", dir], {
  stdio: ["ignore", "inherit", "inherit"],
  timeout: DUMP_TIMEOUT_MS,
  killSignal: "SIGKILL",
});
if (run.error) {
  discardAndFail(
    run.error.code === "ENOENT"
      ? "mongodump is not installed (brew install mongodb-database-tools)"
      : run.error.code === "ETIMEDOUT"
        ? "mongodump did not finish within 10 minutes (is the network down?); the incomplete copy was deleted"
        : run.error.message,
  );
}
if (run.status !== 0) discardAndFail(`mongodump failed (exit ${run.status}); the incomplete copy was deleted. Nothing was changed in the database.`);

const bytes = sizeOf(dir);
if (bytes === 0) discardAndFail("the backup folder is empty, so it cannot be trusted");

console.log(`\nDone: ${(bytes / 1024 / 1024).toFixed(2)} MB saved in ${dir}`);

// Only now that this backup is safely on disk may older ones be removed.
if (keep !== null) {
  const names = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const doomed = selectBackupsToDelete(names, target.db, keep, { justMade: path.basename(dir) });
  for (const name of doomed) fs.rmSync(path.join(base, name), { recursive: true, force: true });
  console.log(
    doomed.length
      ? `Kept the newest ${keep} backups; removed ${doomed.length} older: ${doomed.join(", ")}`
      : `Kept the newest ${keep} backups; nothing older to remove.`,
  );
}
console.log("To bring deleted rows back later (turn expiry off first, or they would be removed again):");
console.log(`  mongorestore --gzip --uri="<your MONGO_URI>" "${dir}"`);
console.log("It adds back rows that are missing and leaves existing ones alone.");

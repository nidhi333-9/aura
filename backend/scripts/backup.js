// Saves a full copy of the database to a folder on THIS computer, using MongoDB's own `mongodump`
// (install: `brew install mongodb-database-tools`). Free Atlas clusters usually can't take
// snapshots, so this is the safety net before anything that deletes data (scripts/enable-raw-ttl.js).
//
//   node scripts/backup.js                   saves to ~/aura-backups/<database>-<date and time>/
//   node scripts/backup.js --out ~/somewhere saves under another folder
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(base, `${target.db}-${stamp}`);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.chmodSync(base, 0o700);
fs.chmodSync(dir, 0o700);

console.log(`Backing up ${target.kind === "remote" ? "the REMOTE" : "a local"} database "${target.db}" to:\n  ${dir}\n`);

const run = spawnSync("mongodump", ["--uri", process.env.MONGO_URI, "--gzip", "--out", dir], {
  stdio: ["ignore", "inherit", "inherit"],
});
if (run.error) {
  fail(run.error.code === "ENOENT" ? "mongodump is not installed (brew install mongodb-database-tools)" : run.error.message);
}
if (run.status !== 0) fail(`mongodump failed (exit ${run.status}). Nothing was changed in the database.`);

const bytes = sizeOf(dir);
if (bytes === 0) fail("the backup folder is empty, so it cannot be trusted");

console.log(`\nDone: ${(bytes / 1024 / 1024).toFixed(2)} MB saved in ${dir}`);
console.log("To bring deleted rows back later (turn expiry off first, or they would be removed again):");
console.log(`  mongorestore --gzip --uri="<your MONGO_URI>" "${dir}"`);
console.log("It adds back rows that are missing and leaves existing ones alone.");

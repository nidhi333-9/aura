// Which old backup folders may be removed. Pure functions, so the one risky step (deleting) is tested
// without touching a disk. scripts/backup.js uses them after a backup has been made successfully.
//
// A backup folder is named "<database>-<UTC time>", for example "aura-2026-10-05T14-30-00". Only
// folders with exactly that shape are ever candidates: anything else in the backups folder (a log,
// a note, another database's backup, a folder the person made by hand) is never touched.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const backupFolderPattern = (database) =>
  new RegExp(`^${escapeRegExp(database)}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}$`);

// Names are timestamps in a sortable form, so sorting the names sorts them by time.
const selectBackupsToDelete = (names, database, keep, { justMade = null } = {}) => {
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("keep must be a whole number of at least 1");
  }
  const pattern = backupFolderPattern(database);
  const backups = names.filter((name) => pattern.test(name)).sort().reverse(); // newest first
  return backups.slice(keep).filter((name) => name !== justMade);
};

// "--keep 12" -> 12; no flag -> null (keep everything); anything unusable -> an error.
const parseKeepOption = (argv) => {
  const index = argv.indexOf("--keep");
  if (index === -1) return null;
  const raw = argv[index + 1];
  const keep = /^\d+$/.test(raw ?? "") ? Number(raw) : NaN;
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("--keep needs a whole number of at least 1, for example --keep 12");
  }
  return keep;
};

// "--min-age-days 6" -> 6; no flag -> null; anything unusable -> an error.
const parseMinAgeOption = (argv) => {
  const index = argv.indexOf("--min-age-days");
  if (index === -1) return null;
  const raw = argv[index + 1];
  const days = /^\d+$/.test(raw ?? "") ? Number(raw) : NaN;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("--min-age-days needs a whole number of at least 1, for example --min-age-days 6");
  }
  return days;
};

// The moment a backup folder was made, read from its name ("aura-2026-10-05T14-30-00", UTC).
const madeAt = (name) => {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/.exec(name);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
};

// Used to make a schedule that runs every day but only backs up when the last one is old enough:
// returns the newest backup's age in days, or null when there is none.
const newestBackupAgeDays = (names, database, now = Date.now()) => {
  const pattern = backupFolderPattern(database);
  const times = names.filter((n) => pattern.test(n)).map(madeAt).filter((t) => t !== null);
  if (!times.length) return null;
  return Math.max(0, (now - Math.max(...times)) / 86400000);
};

module.exports = { backupFolderPattern, selectBackupsToDelete, parseKeepOption, parseMinAgeOption, newestBackupAgeDays };

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  backupFolderPattern, selectBackupsToDelete, parseKeepOption, parseMinAgeOption, newestBackupAgeDays,
} = require("../services/backupFiles");

const folder = (day, time = "10-00-00") => `aura-2026-10-${String(day).padStart(2, "0")}T${time}`;

test("only folders shaped '<database>-<time>' are candidates", () => {
  const pattern = backupFolderPattern("aura");
  assert.ok(pattern.test("aura-2026-10-05T14-30-00"));
  for (const other of [
    "aura-2026-10-05T14-30-00.zip", "aura-2026-10-05", "aura", "aura-backup", "backup.log", "notes.txt",
    "other-2026-10-05T14-30-00", "aura2-2026-10-05T14-30-00", "x-aura-2026-10-05T14-30-00",
    "aura-2026-10-05T14-30-00-old", "my aura backup", "", ".",
  ]) {
    assert.ok(!pattern.test(other), `must not match: ${JSON.stringify(other)}`);
  }
});

test("a database name with special characters cannot widen the pattern", () => {
  const pattern = backupFolderPattern("a.ura");
  assert.ok(pattern.test("a.ura-2026-10-05T14-30-00"));
  assert.ok(!pattern.test("aXura-2026-10-05T14-30-00"));
  assert.ok(!backupFolderPattern(".*").test("aura-2026-10-05T14-30-00"));
});

test("the newest N are kept and the older ones are chosen for removal", () => {
  const names = [folder(1), folder(5), folder(3), folder(4), folder(2)];
  assert.deepEqual(selectBackupsToDelete(names, "aura", 3).sort(), [folder(1), folder(2)]);
  assert.deepEqual(selectBackupsToDelete(names, "aura", 5), []);
  assert.deepEqual(selectBackupsToDelete(names, "aura", 99), []);
  assert.deepEqual(selectBackupsToDelete(names, "aura", 1).sort(), [folder(1), folder(2), folder(3), folder(4)]);
});

test("the order is by time, not by the order the names were listed in", () => {
  assert.deepEqual(selectBackupsToDelete([folder(2), folder(9), folder(1)], "aura", 1).sort(), [folder(1), folder(2)]);
  // two on one day: the later time is newer
  const same = [folder(5, "09-00-00"), folder(5, "21-00-00")];
  assert.deepEqual(selectBackupsToDelete(same, "aura", 1), [folder(5, "09-00-00")]);
});

test("anything that is not a backup folder is never selected, however many backups there are", () => {
  const names = ["backup.log", "notes.txt", "other-2026-01-01T00-00-00", "Do not delete", folder(1), folder(2), folder(3)];
  const doomed = selectBackupsToDelete(names, "aura", 1);
  assert.deepEqual(doomed.sort(), [folder(1), folder(2)]);
  for (const safe of ["backup.log", "notes.txt", "other-2026-01-01T00-00-00", "Do not delete"]) {
    assert.ok(!doomed.includes(safe), safe);
  }
});

test("the backup that was just made is never selected", () => {
  const names = [folder(1), folder(2), folder(3)];
  // even if a clock problem made the new one look old
  assert.deepEqual(selectBackupsToDelete(names, "aura", 1, { justMade: folder(1) }).sort(), [folder(2)]);
});

test("keep must be a whole number of at least 1", () => {
  for (const bad of [0, -1, 1.5, NaN, undefined, null, "3", Infinity]) {
    assert.throws(() => selectBackupsToDelete([folder(1)], "aura", bad), /at least 1/, String(bad));
  }
});

test("nothing to delete when there are no backups or too few", () => {
  assert.deepEqual(selectBackupsToDelete([], "aura", 3), []);
  assert.deepEqual(selectBackupsToDelete([folder(1)], "aura", 3), []);
});

test("--keep is read strictly", () => {
  assert.equal(parseKeepOption(["node", "backup.js"]), null);
  assert.equal(parseKeepOption(["node", "backup.js", "--keep", "12"]), 12);
  assert.equal(parseKeepOption(["--out", "/x", "--keep", "1"]), 1);
  for (const bad of [["--keep"], ["--keep", "0"], ["--keep", "-3"], ["--keep", "abc"], ["--keep", "2.5"], ["--keep", ""], ["--keep", "--out"]]) {
    assert.throws(() => parseKeepOption(bad), /whole number of at least 1/, JSON.stringify(bad));
  }
});

test("--min-age-days is read strictly", () => {
  assert.equal(parseMinAgeOption(["node", "backup.js"]), null);
  assert.equal(parseMinAgeOption(["--keep", "12", "--min-age-days", "6"]), 6);
  for (const bad of [["--min-age-days"], ["--min-age-days", "0"], ["--min-age-days", "-1"], ["--min-age-days", "x"], ["--min-age-days", "1.5"], ["--min-age-days", "--keep"]]) {
    assert.throws(() => parseMinAgeOption(bad), /whole number of at least 1/, JSON.stringify(bad));
  }
});

test("the newest backup's age is read from folder names, ignoring everything that is not a backup", () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0); // 10 Oct 2026, 12:00 UTC
  const names = ["aura-2026-10-01T12-00-00", "aura-2026-10-07T12-00-00", "aura-2026-10-03T00-00-00", "backup.log", "other-2026-10-10T11-00-00"];
  assert.equal(newestBackupAgeDays(names, "aura", now), 3); // 7 Oct 12:00 is the newest of aura's
  assert.equal(newestBackupAgeDays(["aura-2026-10-10T06-00-00"], "aura", now), 0.25);
  assert.equal(newestBackupAgeDays(["backup.log", "other-2026-10-10T11-00-00"], "aura", now), null);
  assert.equal(newestBackupAgeDays([], "aura", now), null);
});

test("a backup 'from the future' (clock change) counts as age 0, never negative", () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);
  assert.equal(newestBackupAgeDays(["aura-2026-10-12T12-00-00"], "aura", now), 0);
});

test("a schedule that runs daily with --min-age-days 6 acts about weekly and retries a missed night", () => {
  const act = (ageDays) => ageDays === null || ageDays >= 6;
  const day = 86400000;
  const base = Date.UTC(2026, 9, 4, 20, 30, 0);
  let backups = [];
  const nightsThatMadeABackup = [];
  for (let n = 0; n < 21; n++) {
    const now = base + n * day;
    const age = newestBackupAgeDays(backups, "aura", now);
    if (n === 6 || n === 7) continue; // the Mac was off these two nights: no run at all
    if (act(age)) {
      backups = [...backups, new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19).replace(/^/, "aura-")];
      nightsThatMadeABackup.push(n);
    }
  }
  // first night, then the next night with a backup at least 6 days old and a run: night 8 (day 6 and 7 were missed), then 14
  assert.deepEqual(nightsThatMadeABackup, [0, 8, 14, 20]);
});

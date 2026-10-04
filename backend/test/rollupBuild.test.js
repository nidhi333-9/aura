const test = require("node:test");
const assert = require("node:assert/strict");

const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const Meta = require("../models/Meta");
const { firstCompleteDay } = require("../services/rollupBuild");

// firstCompleteDay decides which days a rebuild may recompute from raw samples. Getting it wrong
// in one direction DELETES permanent history (a day whose raw samples expired looks "stale"), so
// every way raw samples can have disappeared is covered here, with the database replaced.
const NOW = Date.parse("2026-10-04T12:00:00Z");

const world = ({ ttlDays = null, oldestRaw = null, marker = false, summariesBefore = null, anySummary = false }) => {
  const seen = { olderSummaryFilters: [] };
  Activity.collection.indexes = async () => [
    { name: "_id_", key: { _id: 1 } },
    { name: "user_1_timestamp_-1", key: { user: 1, timestamp: -1 } },
    ...(ttlDays === null ? [] : [{ name: "timestamp_ttl", key: { timestamp: 1 }, expireAfterSeconds: ttlDays * 86400 }]),
  ];
  Activity.collection.find = () => ({
    sort: () => ({ limit: () => ({ toArray: async () => (oldestRaw ? [{ timestamp: new Date(oldestRaw) }] : []) }) }),
  });
  Meta.collection.findOne = async () => (marker ? { _id: "rollups", rawExpiryEnabledAt: new Date() } : { _id: "rollups" });
  DailyStat.collection.findOne = async (filter) => {
    if (filter?.day?.$lt) {
      seen.olderSummaryFilters.push(filter.day.$lt);
      return summariesBefore && summariesBefore < filter.day.$lt ? { _id: 1 } : null;
    }
    return anySummary ? { _id: 1 } : null; // "is there any summary at all?"
  };
  return seen;
};
const safeDay = async () => (await firstCompleteDay(NOW)).day;

test("nothing has ever expired: every day may be rebuilt", async () => {
  world({ oldestRaw: "2026-08-12T05:00:00Z" });
  assert.equal(await safeDay(), "1970-01-01");
});

test("an expiry rule exists: the partly-eaten oldest day is skipped", async () => {
  world({ ttlDays: 30, oldestRaw: "2026-09-04T13:00:00Z" });
  assert.equal(await safeDay(), "2026-09-05");
});

test("the rule was switched OFF but the samples stay deleted: those days must stay protected", async () => {
  // this is the case that used to wipe history: no index, yet raw starts on 20 Sep
  world({ ttlDays: null, marker: true, oldestRaw: "2026-09-20T03:00:00Z" });
  assert.equal(await safeDay(), "2026-09-21");
});

test("no rule and no marker, but summaries older than the oldest raw sample prove expiry happened", async () => {
  const seen = world({ oldestRaw: "2026-09-20T03:00:00Z", summariesBefore: "2026-08-01" });
  assert.equal(await safeDay(), "2026-09-21");
  assert.deepEqual(seen.olderSummaryFilters, ["2026-09-20"], "it looks for summaries before the oldest raw day");
});

test("the period was LENGTHENED (14 -> 30 days): the already-deleted gap must stay protected", async () => {
  // a 30-day rule would say raw is complete from 5 Sep, but raw really starts on 20 Sep
  world({ ttlDays: 30, oldestRaw: "2026-09-20T03:00:00Z" });
  assert.equal(await safeDay(), "2026-09-21");
});

test("the period was SHORTENED: the rule's own cutoff is used when it is later than the data's", async () => {
  // the rule says 3 days left but old rows have not been deleted yet: do not rebuild what is about to go
  world({ ttlDays: 7, oldestRaw: "2026-08-12T05:00:00Z" });
  assert.equal(await safeDay(), "2026-09-28");
});

test("no raw samples at all but summaries exist: no completed day may be recomputed", async () => {
  world({ oldestRaw: null, anySummary: true });
  assert.equal(await safeDay(), "2026-10-04");
  world({ ttlDays: 30, oldestRaw: null, anySummary: false });
  assert.equal(await safeDay(), "2026-10-04");
});

test("an empty database with nothing at all is simply 'everything'", async () => {
  world({ oldestRaw: null, anySummary: false });
  assert.equal(await safeDay(), "1970-01-01");
});

test("the TTL rule is reported back for the scripts' messages", async () => {
  world({ ttlDays: 30, oldestRaw: "2026-09-04T13:00:00Z" });
  assert.equal((await firstCompleteDay(NOW)).ttl.seconds, 30 * 86400);
  world({ oldestRaw: "2026-09-04T13:00:00Z" });
  assert.equal((await firstCompleteDay(NOW)).ttl, null);
});

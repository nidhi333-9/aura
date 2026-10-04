const router = require("express").Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const Activity = require("../models/Activity");
const { buildHistory, windowDates } = require("../services/history");
const { docsForRange, groupsFromDocs, rollupsReady } = require("../services/rollups");
const { isValidTimeZone, zonedToUtc } = require("../services/tz");

const RANGES = { "7d": 7, "30d": 30, "90d": 90 };
// The raw-data path scans every sample in the window (current + previous period). That is fine
// for a month, not for a quarter, so longer ranges need the rollups.
const MAX_RAW_RANGE_DAYS = 30;

// The raw samples, grouped in MongoDB by the user's local hour. Rows written before
// classify-at-ingest have no stored category; for those the app/title are kept in the group key
// so they are classified in JS instead of being dropped.
const groupsFromRaw = (userId, from, to, tz) => {
  const unlabeled = { $in: [{ $type: "$category" }, ["missing", "null"]] };
  return Activity.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: {
          h: { $dateToString: { format: "%Y-%m-%dT%H", date: "$timestamp", timezone: tz } },
          c: "$category",
          a: { $cond: [unlabeled, "$app_name", "$$REMOVE"] },
          t: { $cond: [unlabeled, "$window_title", "$$REMOVE"] },
        },
        n: { $sum: 1 },
      },
    },
  ]).option({ maxTimeMS: 20000 });
};

// The daily rollups: at most one small document per day (see services/rollups.js), re-bucketed
// into the user's local hours here. Same shape out as groupsFromRaw, so buildHistory can't tell
// them apart.
const groupsFromRollups = async (userId, from, to, tz) =>
  groupsFromDocs(await docsForRange(userId, from.getTime(), to.getTime()), tz);

// Today/Week/Month/3 months. ?range=7d|30d|90d (default 7d) and ?tz=<IANA zone> (default UTC).
//
// The period AND the one before it are read in one go (for "vs last period"). Data comes from the
// rollups once scripts/rebuild-rollups.js has verified them (Meta "rollups".ready), and from the
// raw samples until then, so nothing changes, and nothing breaks, before that script has run.
router.get("/", authMiddleware, async (req, res) => {
  const range = req.query.range === undefined ? "7d" : req.query.range;
  if (typeof range !== "string" || !Object.hasOwn(RANGES, range)) {
    return res.status(400).json({ error: "range must be 7d, 30d or 90d" });
  }
  const tz = req.query.tz === undefined ? "UTC" : req.query.tz;
  if (!isValidTimeZone(tz)) {
    return res.status(400).json({ error: "Invalid timezone" });
  }

  const days = RANGES[range];
  const now = new Date();
  const { first, tomorrow } = windowDates(days, tz, now);
  const from = zonedToUtc(first.y, first.m, first.d, 0, tz);
  const to = zonedToUtc(tomorrow.y, tomorrow.m, tomorrow.d, 0, tz);

  try {
    const useRollups = await rollupsReady();
    if (!useRollups && days > MAX_RAW_RANGE_DAYS) {
      return res.status(503).json({
        error: "Longer history isn't available yet. It switches on once your data has been summarised (see the README).",
      });
    }

    const groups = useRollups
      ? await groupsFromRollups(req.user.id, from, to, tz)
      : await groupsFromRaw(req.user.id, from, to, tz);

    const history = buildHistory(groups, { tz, days, now });
    history.meta.source = useRollups ? "rollups" : "raw";
    res.json(history);
  } catch (err) {
    if (/time ?zone/i.test(err.message)) {
      return res.status(400).json({ error: "Unsupported timezone" });
    }
    console.error("HISTORY ERROR:", err.message);
    res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;

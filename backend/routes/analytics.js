const express = require("express");
const router = express.Router();
const axios = require("axios");
const Activity = require("../models/Activity");
const limits = require("../middleware/limits");
const { buildHourlyTrend } = require("../services/focus");
const { isValidTimeZone, localDate, zonedToUtc } = require("../services/tz");

const ML_URL = "https://aura-ml-hshh.onrender.com";

// The ML service is not public: it only answers requests carrying this secret.
const mlHeaders = () => ({
  "X-Aura-Secret": process.env.ML_SHARED_SECRET || "",
});

// DEPRECATED: the dashboard now uses GET /api/live (no ML service, one scoring engine).
// Kept for one release so a dashboard tab opened before the deploy keeps working.
// Delete this route, mlHeaders and ML_URL once the new frontend is live.
router.get("/", limits.authed, async (req, res) => {
  try {
    const mlData = await axios.get(
      `${ML_URL}/analytics?user_id=${req.user.id}`,
      {
        timeout: 25000,
        headers: { Connection: "keep-alive", ...mlHeaders() },
      },
    );

    if (mlData.data.current_app === "Error") {
      throw new Error("ML service returned an internal error");
    }

    res.json(mlData.data);
  } catch (err) {
    console.error("ML ERROR:", err.message);

    try {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const activities = await Activity.find({
        user: req.user.id,
        timestamp: { $gte: since },
      }).sort({ timestamp: -1 });

      if (!activities.length) {
        return res.json({
          focus_score: 0,
          current_app: "No activity yet",
          most_used: "No activity yet",
        });
      }

      const current_app = activities[0].app_name;
      const appCount = {};
      activities.forEach(({ app_name }) => {
        appCount[app_name] = (appCount[app_name] || 0) + 1;
      });
      const most_used = Object.entries(appCount).sort(
        (a, b) => b[1] - a[1],
      )[0][0];

      const productiveApps = [
        "Visual Studio Code",
        "Code",
        "Cursor",
        "Terminal",
        "iTerm2",
        "Postman",
        "IntelliJ",
        "PyCharm",
        "Claude",
        "ChatGPT",
      ];
      const productiveCount = activities.filter((a) =>
        productiveApps.includes(a.app_name),
      ).length;
      const focus_score = Math.round(
        (productiveCount / activities.length) * 100,
      );

      const top_sites = Object.fromEntries(
        Object.entries(appCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
      );
      const app_distribution = {
        Productive: productiveCount,
        Neutral: activities.length - productiveCount,
      };

      res.json({
        focus_score,
        current_app,
        most_used,
        top_sites,
        app_distribution,
        total_logs: activities.length,
      });
    } catch (fallbackErr) {
      console.error("FALLBACK ERROR:", fallbackErr.message);
      res.status(500).json({ error: "Both ML service and DB fallback failed" });
    }
  }
});

// Today's focus by hour in the caller's time zone (?tz=Asia/Kolkata, default UTC for
// older clients). Computed from MongoDB with the same rules as /api/live, so the chart
// and the score card can't disagree. Hours with no activity are `null`, not 0.
router.get("/daily-trend", limits.authed, async (req, res) => {
  const tz = req.query.tz === undefined ? "UTC" : req.query.tz;
  if (!isValidTimeZone(tz)) {
    return res.status(400).json({ error: "Invalid timezone" });
  }

  try {
    const now = new Date();
    const { y, m, d } = localDate(now, tz);
    const startOfLocalDay = zonedToUtc(y, m, d, 0, tz);

    const rows = await Activity.find({
      user: req.user.id,
      timestamp: { $gte: startOfLocalDay },
    })
      .select("app_name window_title site category timestamp")
      .lean();

    res.json(buildHourlyTrend(rows, tz, now));
  } catch (err) {
    console.error("DAILY TREND ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch history" });
  }
});

module.exports = router;

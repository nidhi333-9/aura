const express = require("express");
const router = express.Router();
const axios = require("axios");
const Activity = require("../models/Activity");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

const ML_URL = "https://aura-ml-hshh.onrender.com";

router.get("/", authMiddleware, async (req, res) => {
  try {
    const mlData = await axios.get(
      `${ML_URL}/analytics?user_id=${req.user.id}`,
      {
        timeout: 25000,
        headers: { Connection: "keep-alive" },
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

router.get("/daily-trend", authMiddleware, async (req, res) => {
  try {
    const mlData = await axios.get(
      `${ML_URL}/hourly-trend?user_id=${req.user.id}`,
      { timeout: 25000 },
    );

    if (!Array.isArray(mlData.data)) {
      throw new Error("ML service returned an unexpected shape");
    }

    const formatted = mlData.data.map((item) => ({
      time: item.hour,
      score: item.score,
    }));
    return res.json(formatted);
  } catch (err) {
    console.error("HOURLY TREND ML ERROR:", err.message);

    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const activities = await Activity.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(req.user.id),
            timestamp: { $gte: startOfDay },
          },
        },
        {
          $group: {
            _id: { $hour: "$timestamp" },
            focusPoints: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$app_name",
                      [
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
                      ],
                    ],
                  },
                  10,
                  2,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const pointsByHour = new Map(
        activities.map((item) => [item._id, item.focusPoints]),
      );
      const formattedData = Array.from({ length: 24 }, (_, hour) => {
        const focusPoints = pointsByHour.get(hour);
        const score =
          focusPoints === undefined
            ? 0
            : Math.min(Math.max(Math.round(focusPoints / 5), 20), 100);
        const bucketTime = new Date(startOfDay);
        bucketTime.setUTCHours(hour);
        return { time: bucketTime.toISOString(), score };
      });

      res.json(formattedData);
    } catch (fallbackErr) {
      console.error("DB AGGREGATION ERROR:", fallbackErr.message);
      res.status(500).json({ error: "Could not fetch history" });
    }
  }
});

module.exports = router;

const authMiddleware = require("../middleware/authMiddleware");
const Activity = require("../models/Activity");

const router = require("express").Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const logs = await Activity.find({ user: req.user.id })
      .sort({ timestamp: -1 })
      .limit(500);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;

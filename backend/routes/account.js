const router = require("express").Router();
const limits = require("../middleware/limits");
const Activity = require("../models/Activity");
const DailyStat = require("../models/DailyStat");
const Device = require("../models/Device");
const PairingCode = require("../models/PairingCode");
const User = require("../models/User");

// A person's control over their own data. Every query here is filtered by the caller's own user
// id (from their login token), so nobody can read or delete anyone else's.
//
// Both delete routes need the caller to say so in the body. A stray request, or a typo in a
// script, can never wipe anything by itself.
const CONFIRM_WORD = "DELETE";
const confirmed = (req) => req.body?.confirm === CONFIRM_WORD;
const NOT_CONFIRMED = {
  error: `Send {"confirm":"${CONFIRM_WORD}"} in the request body to confirm. This can't be undone.`,
};

// What Aura currently holds, so the dashboard can show it before anything is deleted.
router.get("/summary", limits.authed, async (req, res) => {
  const user = req.user.id;
  try {
    const [samples, first, days, devices] = await Promise.all([
      Activity.countDocuments({ user }),
      Activity.findOne({ user }).sort({ timestamp: 1 }).select("timestamp").lean(),
      DailyStat.countDocuments({ user }),
      Device.countDocuments({ user, revokedAt: null }),
    ]);
    res.json({
      samples,
      first_sample: first?.timestamp ? new Date(first.timestamp).toISOString() : null,
      days_summarised: days,
      devices,
    });
  } catch (err) {
    console.error("ACCOUNT SUMMARY ERROR:", err.message);
    res.status(500).json({ error: "Could not load your data summary" });
  }
});

// Delete everything that was tracked (the raw samples with their window titles, and the daily
// summaries). The account and the paired devices stay, and the sensor keeps working.
router.delete("/data", limits.authedDestructive, async (req, res) => {
  if (!confirmed(req)) return res.status(400).json(NOT_CONFIRMED);
  const user = req.user.id;
  try {
    const samples = await Activity.deleteMany({ user });
    const days = await DailyStat.deleteMany({ user });
    res.json({ deleted: { samples: samples.deletedCount, days: days.deletedCount } });
  } catch (err) {
    console.error("ACCOUNT DATA DELETE ERROR:", err.message);
    res.status(500).json({ error: "Could not delete your data. Nothing more was removed; please try again." });
  }
});

// Delete the account and everything attached to it. Safe to repeat after a failure: it removes
// the user record last, so a half-finished run still leaves an account that can try again.
router.delete("/", limits.authedDestructive, async (req, res) => {
  if (!confirmed(req)) return res.status(400).json(NOT_CONFIRMED);
  const user = req.user.id;
  try {
    // Devices first: their keys stop working at once, so no new samples arrive while the rest goes.
    const devices = await Device.deleteMany({ user });
    const samples = await Activity.deleteMany({ user });
    const days = await DailyStat.deleteMany({ user });
    await PairingCode.deleteMany({ user });
    await User.deleteOne({ _id: user });
    res.json({
      deleted: {
        account: true,
        devices: devices.deletedCount,
        samples: samples.deletedCount,
        days: days.deletedCount,
      },
    });
  } catch (err) {
    console.error("ACCOUNT DELETE ERROR:", err.message);
    res.status(500).json({ error: "Could not delete your account completely. Please try again." });
  }
});

module.exports = router;

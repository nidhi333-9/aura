const router = require("express").Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const Device = require("../models/Device");
const PairingCode = require("../models/PairingCode");
const User = require("../models/User");
const { SENSOR_ONLINE_WITHIN_MS } = require("../services/focus");
const {
  generateCode,
  formatCode,
  normalizeCode,
  isWellFormedCode,
  generateDeviceKey,
  sha256,
  cleanText,
} = require("../services/pairing");

// Configurable so the expiry can be exercised in tests without waiting ten minutes.
const PAIR_CODE_TTL_SECONDS = Number(process.env.PAIR_CODE_TTL_SECONDS) || 600;
const MAX_ACTIVE_DEVICES = 10;
const INVALID_CODE = "That pairing code is invalid or has expired. Generate a new one from your dashboard.";

// --- dashboard (user session) ---------------------------------------------------------

// Mint a code for the logged-in user. One live code per user: asking for a new one
// invalidates the previous one.
router.post("/pair-code", authMiddleware, async (req, res) => {
  try {
    if (!(await User.exists({ _id: req.user.id }))) {
      return res.status(401).json({ message: "User not found" });
    }
    await PairingCode.deleteMany({ user: req.user.id, usedAt: null });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const raw = generateCode();
      try {
        const doc = await PairingCode.create({
          user: req.user.id,
          codeHash: sha256(raw),
          expiresAt: new Date(Date.now() + PAIR_CODE_TTL_SECONDS * 1000),
        });
        return res.json({
          code: formatCode(raw),
          expires_at: doc.expiresAt.toISOString(),
          expires_in: PAIR_CODE_TTL_SECONDS,
        });
      } catch (err) {
        if (err.code !== 11000) throw err; // duplicate hash: astronomically unlikely, just retry
      }
    }
    throw new Error("could not allocate a pairing code");
  } catch (err) {
    console.error("PAIR-CODE ERROR:", err.message);
    res.status(500).json({ error: "Could not create a pairing code" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const now = Date.now();
    const devices = await Device.find({ user: req.user.id, revokedAt: null })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      devices: devices.map((d) => ({
        id: String(d._id),
        name: d.name,
        os: d.os || null,
        created_at: d.createdAt.toISOString(),
        last_seen: d.lastSeen ? d.lastSeen.toISOString() : null,
        online: !!d.lastSeen && now - d.lastSeen.getTime() <= SENSOR_ONLINE_WITHIN_MS,
      })),
    });
  } catch (err) {
    console.error("DEVICES LIST ERROR:", err.message);
    res.status(500).json({ error: "Could not load your devices" });
  }
});

// Revoke: the device's key stops working on its next request. Idempotent.
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Device not found" });
    }
    const filter = { _id: req.params.id, user: req.user.id };
    await Device.updateOne({ ...filter, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (!(await Device.exists(filter))) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DEVICE REVOKE ERROR:", err.message);
    res.status(500).json({ error: "Could not remove the device" });
  }
});

// --- sensor (no session: the one-time code is the credential) --------------------------

router.post("/pair", async (req, res) => {
  const raw = normalizeCode(req.body?.code);
  if (!isWellFormedCode(raw)) {
    return res.status(400).json({ error: INVALID_CODE });
  }
  const name = cleanText(req.body?.name, 60) || "Unnamed device";
  const os = cleanText(req.body?.os, 40);

  let claimed = null;
  try {
    // Claim atomically: of two simultaneous requests with the same code, exactly one wins.
    const now = new Date();
    claimed = await PairingCode.findOneAndUpdate(
      { codeHash: sha256(raw), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
    );
    if (!claimed) {
      return res.status(400).json({ error: INVALID_CODE });
    }

    const active = await Device.countDocuments({ user: claimed.user, revokedAt: null });
    if (active >= MAX_ACTIVE_DEVICES) {
      await PairingCode.updateOne({ _id: claimed._id }, { $set: { usedAt: null } });
      return res.status(409).json({
        error: `You already have ${MAX_ACTIVE_DEVICES} paired devices. Remove one in your dashboard, then try again.`,
      });
    }

    const deviceKey = generateDeviceKey();
    const device = await Device.create({
      user: claimed.user,
      name,
      os,
      keyHash: sha256(deviceKey),
    });
    // The key is returned exactly once; only its hash is stored.
    res.json({ device_key: deviceKey, device: { id: String(device._id), name: device.name } });
  } catch (err) {
    console.error("PAIR ERROR:", err.message);
    if (claimed) {
      // Don't burn the user's code over a server hiccup.
      await PairingCode.updateOne({ _id: claimed._id }, { $set: { usedAt: null } }).catch(() => {});
    }
    res.status(500).json({ error: "Could not pair this device. Please try again." });
  }
});

module.exports = router;

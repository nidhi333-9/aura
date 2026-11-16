const Device = require("../models/Device");
const { sha256 } = require("../services/pairing");

const LAST_SEEN_WRITE_INTERVAL_MS = 30 * 1000;

const OUT_OF_DATE =
  "This sensor is out of date. Open your Aura dashboard, use 'Connect a sensor', and run the new install command.";

const ingestAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Device ")) {
    return res.status(401).json({ message: OUT_OF_DATE });
  }

  const key = header.slice("Device ".length).trim();
  if (!key) return res.status(401).json({ message: "No device key provided" });

  try {
    const device = await Device.findOne({
      keyHash: sha256(key),
      revokedAt: null,
    })
      .select("_id user lastSeen")
      .lean();
    if (!device) {
      return res.status(401).json({ message: "Unknown or revoked device" });
    }

    req.user = { id: String(device.user) };
    req.device = { id: String(device._id) };

    const now = Date.now();
    if (
      !device.lastSeen ||
      now - device.lastSeen.getTime() > LAST_SEEN_WRITE_INTERVAL_MS
    ) {
      await Device.updateOne(
        { _id: device._id },
        { $set: { lastSeen: new Date(now) } },
      );
    }
    next();
  } catch (err) {
    console.error("INGEST AUTH ERROR:", err.message);
    res.status(500).json({ message: "Could not verify the device" });
  }
};

module.exports = ingestAuth;

const authMiddleware = require("./authMiddleware");
const Device = require("../models/Device");
const User = require("../models/User");
const { sha256 } = require("../services/pairing");

// Writing lastSeen on every 10-second sample would be a database write per sample just to
// move a timestamp; once every 30 s is plenty for an online/offline indicator.
const LAST_SEEN_WRITE_INTERVAL_MS = 30 * 1000;

// Authentication for the sensor's POST /api/log-activity only.
//   Authorization: Device <key>  -> a paired sensor. The key is looked up by its hash, so
//                                    revoking a device takes effect on its very next sample.
//   anything else                -> the old behaviour (a user session JWT), so sensors
//                                    installed before pairing existed keep working.
// A device key is deliberately NOT accepted by authMiddleware: it can post activity and
// nothing else (it can't read data, list devices or mint codes).
const ingestAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Device ")) {
    // A session token stays valid for 7 days even after the account is deleted. Without this
    // check an old-style sensor would keep writing data for a user who no longer exists, which
    // nobody could ever delete. (Paired devices are deleted with the account, so they stop.)
    return authMiddleware(req, res, async () => {
      try {
        if (!(await User.exists({ _id: req.user.id }))) {
          return res.status(401).json({ message: "User not found" });
        }
      } catch (err) {
        console.error("INGEST AUTH ERROR:", err.message);
        return res.status(500).json({ message: "Could not verify the account" });
      }
      next();
    });
  }

  const key = header.slice("Device ".length).trim();
  if (!key) return res.status(401).json({ message: "No device key provided" });

  try {
    const device = await Device.findOne({ keyHash: sha256(key), revokedAt: null })
      .select("_id user lastSeen")
      .lean();
    if (!device) {
      return res.status(401).json({ message: "Unknown or revoked device" });
    }

    req.user = { id: String(device.user) };
    req.device = { id: String(device._id) };

    const now = Date.now();
    if (!device.lastSeen || now - device.lastSeen.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
      await Device.updateOne({ _id: device._id }, { $set: { lastSeen: new Date(now) } });
    }
    next();
  } catch (err) {
    // A database problem is not "your key is bad": answering 401 would make a healthy
    // sensor think it was revoked and forget its key.
    console.error("INGEST AUTH ERROR:", err.message);
    res.status(500).json({ message: "Could not verify the device" });
  }
};

module.exports = ingestAuth;

const mongoose = require("mongoose");

// A paired desktop sensor. The raw device key is shown to the sensor once, at pairing, and
// never stored: only its hash is, so a database leak can't be replayed as a sensor.
const deviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    os: { type: String },
    keyHash: { type: String, required: true, unique: true },
    lastSeen: { type: Date },
    // Set when the user removes the device. The key stops working immediately.
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

deviceSchema.index({ user: 1, revokedAt: 1 });

module.exports = mongoose.model("Device", deviceSchema);

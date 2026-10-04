const mongoose = require("mongoose");

// A one-time code the dashboard shows so a sensor can pair itself. Short-lived, single use,
// and stored only as a hash.
const pairingCodeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  codeHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

// MongoDB deletes expired codes on its own (its TTL job runs about once a minute). Pairing
// still checks expiresAt itself, so a code is dead the moment it expires, not a minute later.
pairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PairingCode", pairingCodeSchema);

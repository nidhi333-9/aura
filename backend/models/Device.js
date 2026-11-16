const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    os: { type: String },
    keyHash: { type: String, required: true, unique: true },
    lastSeen: { type: Date },

    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

deviceSchema.index({ user: 1, revokedAt: 1 });

module.exports = mongoose.model("Device", deviceSchema);

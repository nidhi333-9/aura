const mongoose = require("mongoose");

const metaSchema = new mongoose.Schema(
  {
    _id: { type: String },
    liveSince: { type: Date },
    ready: { type: Boolean, default: false },
    builtAt: { type: Date },
  },
  { versionKey: false },
);

module.exports = mongoose.model("Meta", metaSchema, "meta");

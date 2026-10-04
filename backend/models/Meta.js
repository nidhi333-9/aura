const mongoose = require("mongoose");

// Operational state that isn't user data. Today there is one document, _id "rollups":
//   liveSince  when this backend first wrote a rollup. Set automatically at ingest. The rebuild
//              script refuses to declare rollups complete unless this predates its own run,
//              because that is what guarantees no sample fell between "backfill" and "live".
//   ready      set only by scripts/rebuild-rollups.js after it has rebuilt and verified the
//              rollups. /api/history reads rollups only when this is true.
//   builtAt    when the script last declared them ready.
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

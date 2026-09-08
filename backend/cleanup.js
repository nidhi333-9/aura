const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const Activity = require("./models/Activity");

async function cleanup() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is still undefined");
    return process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected to database:", mongoose.connection.name);
  const totalCount = await Activity.countDocuments({});
  console.log("Total documents in activities collection:", totalCount);

  const fakeCount = await Activity.countDocuments({ window_title: "" });
  console.log(`Found ${fakeCount} fake entries (empty window_title)`);

  if (fakeCount === 0) {
    console.log("Nothing to clean up.");
    return process.exit(0);
  }

  const result = await Activity.deleteMany({ window_title: "" });
  console.log(`Deleted ${result.deletedCount} fake entries`);
  process.exit(0);
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});

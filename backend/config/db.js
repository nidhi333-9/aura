const mongoose = require("mongoose");
const { describeMongoTarget } = require("./mongoTarget");

const connectDB = async () => {
  try {
    const connString =
      process.env.MONGO_URI || "mongodb://localhost:27017/aura";

    const target = describeMongoTarget(connString);
    console.log(
      `Connecting to a ${target.kind === "local" ? "local" : "REMOTE"} MongoDB, database "${target.db}"`,
    );
    if (target.kind !== "local" && process.env.NODE_ENV !== "production") {
      console.warn(
        "⚠️  This is a REMOTE database. If you are developing locally, you are about to read and write real data.\n" +
          "   Put MONGO_URI=mongodb://localhost:27017/aura in backend/.env.local to use a local database instead.",
      );
    }

    await mongoose.connect(connString);
    console.log("🚀 MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  }
};

module.exports = connectDB;

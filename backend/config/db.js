const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // 1. Use the environment variable from Railway UI,
    // or fallback to local only for development.
    const connString =
      process.env.MONGO_URI || "mongodb://localhost:27017/aura";

    console.log(
      `Attempting connection to: ${connString.includes("internal") ? "Railway Internal DB" : "Localhost"}`,
    );

    await mongoose.connect(connString);
    console.log("🚀 MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);

    // 2. CRITICAL: Don't exit the process in production.
    // This allows the server to stay "Up" so you can see logs.
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  }
};

module.exports = connectDB;

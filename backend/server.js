const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { trustProxyHops } = require("./middleware/limits");

// .env.local (local overrides) > .env; real environment variables beat both. See config/env.js.
const { loaded } = require("./config/env")();
console.log(`Environment: ${loaded.length ? loaded.join(" + ") : "no .env files, using real environment variables"}`);

// Fail fast: a missing secret must never silently fall back to a guessable one.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}
if (!process.env.ML_SHARED_SECRET) {
  console.warn(
    "ML_SHARED_SECRET is not set: the ML service will reject requests and analytics will use the DB fallback.",
  );
}

const app = express();

// Behind Render's proxy every request arrives from the proxy, so Express must be told how many
// proxies to believe when it works out the caller's address (used by the request limits).
app.set("trust proxy", trustProxyHops());

app.use(
  cors({
    origin: ["https://aura-gamma-eight.vercel.app", "http://localhost:5173"],
    credentials: true,
  }),
);
// The biggest legitimate body (a sample, a pairing request, a login) is a few kilobytes.
app.use(express.json({ limit: "32kb" }));

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/api/live", require("./routes/live"));
app.use("/api/history", require("./routes/history"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/account", require("./routes/account"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api", require("./routes/activity"));
app.use("/api", require("./routes/youtube"));
app.use("/api", require("./routes/network"));

app.get("/", (req, res) => {
  res.send("Aura Backend is running...");
});

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

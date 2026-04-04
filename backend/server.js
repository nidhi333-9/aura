const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: ["https://aura-gamma-eight.vercel.app", "http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/", require("./routes/saveToken"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api", require("./routes/activity"));
app.use("/api", require("./routes/youtube"));

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

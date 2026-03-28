const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const connectDB = require("./config/db");
connectDB();
app.use("/auth", require("./routes/auth"));

// const authMiddleware = require("./middleware/authMiddleware");
// app.get("/dashboard", authMiddleware, (req, res) => {
//   res.json({ message: "Welcome to dashboard 🔥" });
// });

app.use("/dashboard", require("./routes/dashboard"));
app.use("/analytics", require("./routes/analytics"));
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

app.listen(8080, () => console.log("Server is running on port 8080"));

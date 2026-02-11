const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");

const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");

const app = express();

app.use(cors());
app.use(express.json());

// Роуты
app.use("/api/auth", authRoutes);
app.use("/api", protectedRoutes);

// Тестовый маршрут
app.get("/", (req, res) => {
  res.json({ message: "Accounting App API" });
});

module.exports = app;

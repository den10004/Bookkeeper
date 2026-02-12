const express = require("express");
const sequelize = require("./config/db");
const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");

const app = express();
app.use(express.json());

(async () => {
  try {
    await sequelize.sync({ force: false });
    console.log("БД подключена");
  } catch (err) {
    console.error("Ошибка подключения БД:", err);
  }
})();

app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

module.exports = app;

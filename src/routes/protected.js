const express = require("express");
const auth = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");

const router = express.Router();

// Только бухгалтер
router.get("/reports", auth, roleMiddleware(["accountant"]), (req, res) => {
  res.json({ message: "Отчёты — доступ только для accountant" });
});

// Менеджер + директор
router.get(
  "/team",
  auth,
  roleMiddleware(["manager", "director"]),
  (req, res) => {
    res.json({ message: "Информация о команде — manager и director" });
  },
);

// Только директор
router.get("/finance", auth, roleMiddleware(["director"]), (req, res) => {
  res.json({ message: "Финансовые данные — только director" });
});

// Доступ всем авторизованным
router.get("/profile", auth, (req, res) => {
  res.json({ message: "Ваш профиль", user: req.user });
});

module.exports = router;

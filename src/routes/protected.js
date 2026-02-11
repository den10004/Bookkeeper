const express = require("express");
const verifyToken = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");
const User = require("../models/user");
const bcrypt = require("bcryptjs");

const router = express.Router();

// Отладочный middleware (можно убрать позже)
router.use((req, res, next) => {
  console.log(`Protected route hit: ${req.method} ${req.originalUrl}`);
  next();
});

// ───────────────────────────────────────────────
// 1. Получить данные текущего пользователя (о себе)
// ───────────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] }, // не отдаём пароль
    });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(user);
  } catch (err) {
    console.error("Ошибка в /me:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ───────────────────────────────────────────────
// 2. Обновление своего профиля (доступно всем авторизованным)
// ───────────────────────────────────────────────
router.put("/update/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  // Можно обновлять только свой аккаунт
  if (parseInt(id) !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Можно обновлять только свой профиль" });
  }

  const { username, email, password, role } = req.body;
  const updates = {};

  if (username) updates.username = username;
  if (email) updates.email = email;
  if (password) updates.password = await bcrypt.hash(password, 10);
  // role обычно не дают менять самому себе — убираем или оставляем под контролем
  // if (role && ['accountant', 'director', 'manager'].includes(role)) updates.role = role;

  try {
    const [updated] = await User.update(updates, { where: { id } });
    if (!updated) {
      return res
        .status(404)
        .json({ message: "Пользователь не найден или ничего не изменилось" });
    }

    res.json({ message: "Профиль обновлён" });
  } catch (err) {
    console.error("Ошибка обновления профиля:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ───────────────────────────────────────────────
// 3. Удаление своего профиля
// ───────────────────────────────────────────────
router.delete("/delete/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Можно удалить только свой аккаунт" });
  }

  try {
    const deleted = await User.destroy({ where: { id } });
    if (!deleted) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json({ message: "Аккаунт удалён" });
  } catch (err) {
    console.error("Ошибка удаления аккаунта:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ───────────────────────────────────────────────
// 4. Список всех пользователей — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
router.get(
  "/users",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "role",
          "createdAt",
          "updatedAt",
        ],
      });
      res.json(users);
    } catch (err) {
      console.error("Ошибка получения списка пользователей:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// ───────────────────────────────────────────────
// 5. Обновление любого пользователя — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
router.put(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    const { id } = req.params;

    // Нельзя редактировать самого себя через этот маршрут (для безопасности)
    if (parseInt(id) === req.user.id) {
      return res
        .status(403)
        .json({ message: "Используйте /update/:id для изменения себя" });
    }

    const { username, email, password, role } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (email) updates.email = email;
    if (password) updates.password = await bcrypt.hash(password, 10);
    if (role && ["accountant", "director", "manager"].includes(role)) {
      updates.role = role;
    }

    try {
      const [updated] = await User.update(updates, { where: { id } });
      if (!updated) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Пользователь обновлён" });
    } catch (err) {
      console.error("Ошибка обновления пользователя:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// ───────────────────────────────────────────────
// 6. Удаление любого пользователя — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
router.delete(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res
        .status(403)
        .json({ message: "Нельзя удалить самого себя через этот маршрут" });
    }

    try {
      const deleted = await User.destroy({ where: { id } });
      if (!deleted) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Пользователь удалён" });
    } catch (err) {
      console.error("Ошибка удаления пользователя:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

router.get(
  "/director-only",
  verifyToken,
  roleMiddleware(["director"]),
  (req, res) => {
    res.json({ message: "Добро пожаловать, директор!" });
  },
);

module.exports = router;

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { loginLimiter } = require("../middleware/rateLimit");
const crypto = require("crypto");
require("dotenv").config();

const router = express.Router();

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Укажите email и пароль" });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Сохраняем хэш свежевыданного refresh-токена
    const refreshHash = hashRefreshToken(refreshToken);
    await user.update({ refreshTokenHash: refreshHash });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Ошибка при входе:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh-токен не передан" });
  }

  try {
    // 1. Проверяем подпись и срок действия токена
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    // 2. Ищем пользователя
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "role", "refreshTokenHash"],
    });

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    // 3. Проверяем, совпадает ли хэш переданного токена с сохранённым
    const incomingHash = hashRefreshToken(refreshToken);
    if (user.refreshTokenHash !== incomingHash) {
      // Токен не совпадает → возможно, это старый/украденный токен
      // Можно здесь же обнулить refreshTokenHash для параноидального режима
      await user.update({ refreshTokenHash: null });
      return res.status(401).json({
        message: "Недействительный refresh-токен (возможно, уже использован)",
      });
    }

    // 4. Генерируем новую пару токенов (rotation)
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const newRefreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // 5. Сохраняем хэш нового refresh-токена → старый становится недействительным
    const newHash = hashRefreshToken(newRefreshToken);
    await user.update({ refreshTokenHash: newHash });

    // 6. Возвращаем новую пару
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    // Просрочен / неверная подпись / etc.
    return res
      .status(401)
      .json({ message: "Недействительный или просроченный refresh-токен" });
  }
});

module.exports = router;

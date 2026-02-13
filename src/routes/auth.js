const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { loginLimiter } = require("../middleware/rateLimit");
require("dotenv").config();

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Укажите email и password" });
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
    return res.status(400).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "role"],
    });

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

module.exports = router;

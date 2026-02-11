const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Sequelize } = require("sequelize");
const User = require("../models/user");
require("dotenv").config();

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  // Валидация входных данных
  if (!username || !email || !password || !role) {
    return res
      .status(400)
      .json({
        message: "Все поля обязательны: username, email, password, role",
      });
  }

  if (!["accountant", "director", "manager"].includes(role)) {
    return res.status(400).json({ message: "Недопустимая роль" });
  }

  try {
    // Проверяем существование пользователя (по username ИЛИ email)
    const existingUser = await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ username: username }, { email: email }],
      },
    });

    // Теперь existingUser точно существует в этой области видимости
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ message: "Username уже занят" });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email уже зарегистрирован" });
      }
      // на всякий случай
      return res.status(400).json({ message: "Пользователь уже существует" });
    }

    // Если дошли сюда — пользователя нет, создаём
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
    });

    // Успешный ответ
    res.status(201).json({
      message: "Пользователь успешно зарегистрирован",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Ошибка регистрации:", err);
    res.status(500).json({
      message: "Ошибка сервера при регистрации",
      error: err.message, // временно для отладки
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Проверка обязательных полей
  if (!email || !password) {
    return res.status(400).json({ message: "Укажите email и password" });
  }

  try {
    // Ищем пользователя по email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    // Генерируем токены
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, {
      expiresIn: "7d",
    });

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

// Refresh Token
router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const accessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

module.exports = router;

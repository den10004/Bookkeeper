const express = require("express");
const sequelize = require("./config/db");
const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const User = require("./models/user");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? ["https"] : [],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    crossOriginEmbedderPolicy: "require-corp",
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),
);

app.use(
  cors({
    origin: [process.env.CORS_ORIGIN],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { message: "Слишком много запросов. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Внутренняя ошибка сервера"
      : err.message || "Неизвестная ошибка";
  res.status(status).json({ message });
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL подключён");

    // Обычная безопасная синхронизация (оставляем как было изначально)
    await sequelize.sync({ force: false });
    console.log("Синхронизация моделей завершена");

    const directorExists = await User.findOne({
      where: { role: "director" },
    });

    if (!directorExists) {
      const plainPassword = process.env.PASSWORD_DIRECTOR;

      if (!plainPassword || plainPassword.trim() === "") {
        console.error(
          "┌────────────────────────────────────────────────────────────┐",
        );
        console.error(
          "│ ОШИБКА: переменная окружения PASSWORD_DIRECTOR не задана   │",
        );
        console.error(
          "│ или пустая. Начальный директор НЕ СОЗДАН.                  │",
        );
        console.error(
          "│ → задайте PASSWORD_DIRECTOR в .env и перезапустите сервер  │",
        );
        console.error(
          "└────────────────────────────────────────────────────────────┘",
        );
      } else {
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        await User.create({
          username: "director",
          email: "director@example.com",
          password: hashedPassword,
          role: "director",
        });

        console.log("╔════════════════════════════════════════════════════╗");
        console.log("║         СОЗДАН НАЧАЛЬНЫЙ ПОЛЬЗОВАТЕЛЬ DIRECTOR     ║");
        console.log("╠════════════════════════════════════════════════════╣");
        console.log("║  Логин    : director                               ║");
        console.log("║  Email    : director@example.com                   ║");
        console.log("║  Роль     : director                               ║");
        console.log("╚════════════════════════════════════════════════════╝");
      }
    } else {
      console.log("Пользователь director уже существует → пропуск создания");
    }

    app.listen(PORT, () => {
      console.log(`Сервер запущен → http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Критическая ошибка при старте приложения:", err);
    process.exit(1);
  }
})();

module.exports = app;

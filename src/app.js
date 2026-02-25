const express = require("express");
const sequelize = require("./config/db");
const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

const app = express();

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
    origin: process.env.CORS_ORIGIN.split(","),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 150, // ~150 запросов с одного IP (настройте под нагрузку)
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

// ───────────────────────────────────────────────
// Парсинг тела (после security middlewares)
// ───────────────────────────────────────────────
app.use(express.json({ limit: "10mb" })); // лимит размера тела — защита от DoS
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);

// 404 — всегда в конце
app.use((req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

// Глобальный обработчик ошибок (скрываем стек в production)
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
    await sequelize.sync({ force: false });
    console.log("БД подключена");
  } catch (err) {
    console.error("Ошибка подключения БД:", err);
  }
})();

module.exports = app;

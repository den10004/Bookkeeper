const express = require("express");
const sequelize = require("./config/db");
const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");

const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();

// ───────────────────────────────────────────────
// SECURITY MIDDLEWARES
// ───────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // под ваш фронтенд
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
// 2. CORS — строго ограничиваем источники
app.use(
  cors({
    origin: [
      "http://localhost:3000", // dev
      "https://your-frontend-domain.com", // production
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true, // если используете cookies или auth с credentials
    optionsSuccessStatus: 204,
    maxAge: 86400, // кэшируем preflight-запросы на сутки
  }),
);

// 3. Глобальный rate-limit — базовая защита от DDoS/спама/абьюза
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 150, // ~150 запросов с одного IP (настройте под нагрузку)
  message: { message: "Слишком много запросов. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// 5. Доверяем прокси (nginx, Cloudflare и т.д.) — важно для rate-limit по IP и логирования
app.set("trust proxy", 1); // 1 = доверяем первому прокси, или "loopback" / число прокси

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

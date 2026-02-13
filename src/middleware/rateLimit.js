const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток за окно
  message: {
    message: "Слишком много попыток входа. Попробуйте снова через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email?.toLowerCase().trim() || req.ip;
  },
  skipSuccessfulRequests: true,
});

module.exports = {
  loginLimiter,
};

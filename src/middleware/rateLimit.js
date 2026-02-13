const rateLimit = require("express-rate-limit");
const ipKeyGenerator = rateLimit.ipKeyGenerator;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток за окно
  message: {
    message: "Слишком много попыток входа. Попробуйте снова через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase().trim();
    if (email) {
      return `email:${email}`;
    }
    return ipKeyGenerator(req.ip);
  },
  skipSuccessfulRequests: true,
});

module.exports = {
  loginLimiter,
};

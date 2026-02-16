const crypto = require("crypto");

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { hashRefreshToken };

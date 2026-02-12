// middleware/cleanupTmp.js
const fs = require("fs/promises");

module.exports = async (req, res, next) => {
  res.on("finish", async () => {
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          if (err.code !== "ENOENT") console.warn("Cleanup error:", err);
        }
      }
    }
  });
  next();
};

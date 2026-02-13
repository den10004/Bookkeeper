const fs = require("fs/promises");
const path = require("path");

module.exports = async (req, res, next) => {
  const tempFiles = [];

  if (req.files) {
    for (const file of req.files) {
      tempFiles.push(file.path);
    }
  }

  res.on("finish", async () => {
    for (const filePath of tempFiles) {
      try {
        if (
          await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false)
        ) {
          await fs.unlink(filePath);
          console.log(`Очищен временный файл: ${path.basename(filePath)}`);
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.warn(`Ошибка очистки временного файла ${filePath}:`, err);
        }
      }
    }
  });

  res.on("error", async () => {
    for (const filePath of tempFiles) {
      try {
        await fs.unlink(filePath);
      } catch (err) {}
    }
  });

  next();
};

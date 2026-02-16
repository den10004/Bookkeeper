const fs = require("fs/promises");
const path = require("path");

module.exports = (req, res, next) => {
  const tempFiles = [];

  if (req.files) {
    req.files.forEach((file) => {
      if (file.path) tempFiles.push(file.path);
    });
  }

  const cleanup = async () => {
    for (const filePath of tempFiles) {
      try {
        await fs.unlink(filePath);
        console.log(`Удалён временный файл: ${path.basename(filePath)}`);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.warn(`Ошибка очистки временного файла ${filePath}:`, err);
        }
      }
    }
  };

  res.on("finish", cleanup);
  res.on("close", cleanup);

  next();
};

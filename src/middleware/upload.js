const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");

// Функция для генерации уникального имени файла
const generateUniqueFilename = async (uploadDir, originalName, mimetype) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);

  // Санитизируем базовое имя (удаляем опасные символы)
  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, "")
    .substring(0, 50);

  // Генерируем уникальный суффикс
  const uniqueSuffix = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();

  let filename = `${safeBaseName}-${timestamp}-${uniqueSuffix}${ext}`;
  let filepath = path.join(uploadDir, filename);

  // Проверяем, не существует ли уже файл с таким именем
  let counter = 1;
  while (await fs.pathExists(filepath)) {
    filename = `${safeBaseName}-${timestamp}-${uniqueSuffix}-${counter}${ext}`;
    filepath = path.join(uploadDir, filename);
    counter++;
  }

  return filename;
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Создаем временную директорию, если её нет
    const tmpDir = path.join(__dirname, "../tmp");
    await fs.ensureDir(tmpDir);
    cb(null, tmpDir);
  },
  filename: async (req, file, cb) => {
    try {
      // В временной директории используем просто уникальное имя
      const uniqueSuffix = crypto.randomBytes(16).toString("hex");
      const ext = path.extname(file.originalname);
      const filename = `temp-${Date.now()}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    } catch (err) {
      cb(err);
    }
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10, // максимум 10 файлов
  },
  fileFilter: (req, file, cb) => {
    // Проверяем MIME типы
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    // Дополнительно проверяем расширение файла
    const allowedExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".txt",
    ];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Недопустимый формат файла. Разрешенные форматы: ${allowedExts.join(", ")}`,
        ),
      );
    }
  },
});

module.exports = upload;
module.exports.generateUniqueFilename = generateUniqueFilename;

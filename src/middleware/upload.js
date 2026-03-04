const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");
const { generateUniqueFilename } = require("../utils/fileUtils");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tmpDir = path.join(__dirname, "../tmp");
    await fs.ensureDir(tmpDir);
    cb(null, tmpDir);
  },
  filename: async (req, file, cb) => {
    try {
      const filename = await generateUniqueFilename(
        path.join(__dirname, "../tmp"),
        file.originalname,
      );
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
          `Недопустимый формат файла. Разрешённые форматы: ${allowedExts.join(", ")}`,
        ),
      );
    }
  },
});

module.exports = upload;

const multer = require("multer");
const path = require("path");
const crypto = require("crypto"); // Для дополнительной уникальности, если нужно

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "tmp/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + crypto.randomBytes(16).toString("hex");
    let ext = "";
    // Определяем расширение строго по mimetype, а не по originalname
    switch (file.mimetype) {
      case "image/jpeg":
        ext = ".jpg";
        break;
      case "image/png":
        ext = ".png";
        break;
      case "application/pdf":
        ext = ".pdf";
        break;
      case "application/msword":
        ext = ".doc";
        break;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ext = ".docx";
        break;
      default:
        return cb(new Error("Недопустимый mimetype"));
    }
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Недопустимый формат файла"));
    }
  },
});

module.exports = upload;

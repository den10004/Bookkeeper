const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

async function generateUniqueFilename(uploadDir, originalName) {
  const ext = path.extname(originalName);
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, "")
    .substring(0, 50);

  const uniqueSuffix = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();

  let filename = `${baseName}-${timestamp}-${uniqueSuffix}${ext}`;
  let filepath = path.join(uploadDir, filename);
  let counter = 1;

  while (await fs.pathExists(filepath)) {
    filename = `${baseName}-${timestamp}-${uniqueSuffix}-${counter}${ext}`;
    filepath = path.join(uploadDir, filename);
    counter++;
  }

  return filename;
}

module.exports = { generateUniqueFilename };

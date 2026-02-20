const express = require("express");
const bcrypt = require("bcryptjs");
const { body, param, validationResult } = require("express-validator");
const sanitizeFilename = require("sanitize-filename");
const fs = require("fs-extra");
const path = require("path");
const Application = require("../models/application");
const crypto = require("crypto");
const verifyToken = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");
const User = require("../models/user");
const upload = require("../middleware/upload");
const { generateUniqueFilename } = require("../utils/fileUtils");

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Ошибка валидации",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

const validateIdParam = [
  param("id")
    .notEmpty()
    .withMessage("ID обязателен")
    .isInt({ min: 1 })
    .withMessage("ID должен быть положительным целым числом")
    .toInt(),
];

const validateUserCreate = [
  body("username")
    .trim()
    .notEmpty()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username должен быть от 3 до 50 символов")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username может содержать только буквы, цифры и подчеркивание")
    .escape(),

  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Некорректный формат email")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email слишком длинный"),

  body("password")
    .notEmpty()
    .isLength({ min: 6, max: 100 })
    .withMessage("Пароль должен быть от 6 до 100 символов")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("Пароль должен содержать хотя бы одну букву и одну цифру"),

  body("role")
    .notEmpty()
    .withMessage("Роль обязательна")
    .isIn(["accountant", "director", "manager"])
    .withMessage("Недопустимая роль"),
];

const validateApplicationCreate = [
  body("name")
    .notEmpty()
    .isLength({ min: 2, max: 200 })
    .withMessage("Название должно быть от 2 до 200 символов")
    .escape(),
  body("organization")
    .notEmpty()
    .isLength({ min: 2, max: 100 })
    .withMessage("Название организации должно быть от 2 до 100 символов")
    .escape(),

  body("cost")
    .notEmpty()
    .isFloat({ min: 0.01, max: 9999999.99 })
    .withMessage("Стоимость должна быть от 0.01 до 9,999,999.99")
    .toFloat(),

  body("quantity")
    .notEmpty()
    .isInt({ min: 1, max: 999999 })
    .withMessage("Количество должно быть от 1 до 999,999")
    .toInt(),

  body("comment")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Комментарий не должен превышать 1000 символов")
    .escape(),

  body("assignedAccountantId")
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage("Некорректный ID бухгалтера")
    .toInt(),
];

const validateDownload = [
  param("applicationId")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID заявки")
    .toInt(),

  param("filename")
    .notEmpty()
    .isString()
    .withMessage("Имя файла должно быть строкой")
    .custom((value) => {
      if (!/^[a-zA-Z0-9а-яА-ЯёЁ\s._-]+$/.test(value)) {
        throw new Error("Имя файла содержит недопустимые символы");
      }
      return true;
    }),
];

const validateProfileUpdate = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID пользователя")
    .toInt(),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username может содержать только буквы, цифры и подчеркивание")
    .escape(),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email не корректный"),

  body("password")
    .optional()
    .isLength({ min: 6, max: 100 })
    .withMessage("Пароль должен быть от 6 до 100 символов")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("Пароль должен содержать хотя бы одну букву и одну цифру"),
];

const validateUserUpdate = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID пользователя")
    .toInt(),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username может содержать только буквы, цифры и подчеркивание")
    .escape(),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email слишком длинный"),

  body("password")
    .optional()
    .isLength({ min: 6, max: 100 })
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("Пароль должен содержать хотя бы одну букву и одну цифру"),

  body("role")
    .optional()
    .isIn(["accountant", "director", "manager"])
    .withMessage("Недопустимая роль"),
];

// ───────────────────────────────────────────────
// МАРШРУТЫ
// ───────────────────────────────────────────────

// Регистрация пользователя (только для директора)
router.post(
  "/users",
  verifyToken,
  roleMiddleware(["director"]),
  validateUserCreate,
  handleValidationErrors,
  async (req, res) => {
    const { username, password, role, email } = req.body;

    try {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "Пользователь с таким username уже существует" });
      }

      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res
          .status(409)
          .json({ message: "Пользователь с таким email уже существует" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username,
        password: hashedPassword,
        role,
        email,
      });

      const userData = {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email,
        createdAt: newUser.createdAt,
      };

      res.status(201).json({
        message: "Пользователь успешно создан",
        user: userData,
      });
    } catch (err) {
      console.error("Ошибка создания пользователя:", err);
      res.status(500).json({
        message: "Ошибка сервера при создании пользователя",
      });
    }
  },
);

// Создание заявки (только для менеджера)
router.post(
  "/applications",
  verifyToken,
  roleMiddleware(["manager"]),

  // 1. Сначала загружаем файлы (multer парсит form-data)
  upload.array("files", 10),

  // 2. Потом очистка временных файлов
  require("../middleware/cleanupTmp"),

  // 3. Только потом валидация (req.body уже заполнен)
  validateApplicationCreate,
  handleValidationErrors,

  async (req, res) => {
    const {
      name,
      organization,
      cost,
      quantity,
      comment,
      assignedAccountantId,
    } = req.body;

    let application = null;

    try {
      const accountant = await User.findByPk(assignedAccountantId);
      if (!accountant || accountant.role !== "accountant") {
        return res.status(400).json({
          message:
            "assignedAccountantId должен ссылаться на пользователя с ролью accountant",
        });
      }

      application = await Application.create({
        name,
        organization,
        cost: parseFloat(cost),
        quantity: parseInt(quantity, 10),
        comment: comment || null,
        userId: req.user.id,
        assignedAccountantId: parseInt(assignedAccountantId, 10),
      });

      // Обработка файлов
      const uploadDir = path.join(
        __dirname,
        "../../uploads",
        String(application.id),
      );
      await fs.ensureDir(uploadDir);

      const savedFiles = [];

      if (req.files?.length > 0) {
        for (const file of req.files) {
          const uniqueFilename = await generateUniqueFilename(
            uploadDir,
            file.originalname,
            file.mimetype,
          );

          const originalName = sanitizeFilename(file.originalname);
          const newPath = path.join(uploadDir, uniqueFilename);

          // Проверка на обход директорий
          if (
            path.normalize(newPath).indexOf(path.normalize(uploadDir)) !== 0
          ) {
            throw new Error("Попытка обхода директорий");
          }

          await fs.move(file.path, newPath, { overwrite: false });

          savedFiles.push({
            stored: uniqueFilename,
            original: originalName,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      if (savedFiles.length > 0) {
        await application.update({ files: savedFiles });
        await application.reload();
      }

      res.status(201).json({
        message: "Заявка успешно создана",
        application: {
          id: application.id,
          name: application.name,
          organization: application.organization,
          cost: Number(application.cost),
          quantity: Number(application.quantity),
          comment: application.comment,
          assignedAccountantId: Number(application.assignedAccountantId),
          files: application.downloadLinks || [],
          createdAt: application.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.error("Ошибка создания заявки:", err);

      if (application) {
        await application.destroy().catch(console.error);
      }

      res.status(500).json({
        message: "Ошибка сервера при создании заявки",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

// Получение списка заявок
router.get("/applications", verifyToken, async (req, res) => {
  try {
    let applications;

    if (req.user.role === "director") {
      applications = await Application.findAll({
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email", "role"],
          },
          {
            model: User,
            as: "AssignedAccountant",
            attributes: ["id", "username", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else if (req.user.role === "accountant") {
      applications = await Application.findAll({
        where: { assignedAccountantId: req.user.id },
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email", "role"],
          },
          {
            model: User,
            as: "AssignedAccountant",
            attributes: ["id", "username", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else if (req.user.role === "manager") {
      applications = await Application.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email", "role"],
          },
          {
            model: User,
            as: "AssignedAccountant",
            attributes: ["id", "username", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else {
      return res.status(403).json({ message: "Нет прав для просмотра заявок" });
    }

    res.json(applications || []);
  } catch (err) {
    console.error("Ошибка при получении заявок:", err);
    res.status(500).json({
      message: "Ошибка сервера при получении заявок",
      error: err.message,
    });
  }
});

// Получение конкретной заявки
router.get(
  "/applications/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    try {
      const application = await Application.findByPk(req.params.id, {
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email"],
          },
          {
            model: User,
            as: "AssignedAccountant",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      const canView =
        req.user.role === "director" ||
        application.userId === req.user.id ||
        application.assignedAccountantId === req.user.id;

      if (!canView) {
        return res.status(403).json({ message: "Нет доступа к этой заявке" });
      }

      res.json(application);
    } catch (err) {
      console.error("Ошибка получения заявки:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Скачивание файла
router.get(
  "/download/:applicationId/:filename",
  verifyToken,
  validateDownload,
  handleValidationErrors,
  async (req, res) => {
    const { applicationId, filename } = req.params;

    try {
      const application = await Application.findByPk(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      // Проверяем, что файл действительно принадлежит заявке
      const fileExists = application.files.some((f) => f.stored === filename);
      if (!fileExists) {
        return res.status(404).json({ message: "Файл не найден в заявке" });
      }

      const canAccess =
        req.user.role === "director" ||
        application.userId === req.user.id ||
        application.assignedAccountantId === req.user.id;

      if (!canAccess) {
        return res.status(403).json({ message: "Нет доступа к файлу" });
      }

      const filePath = path.join(
        __dirname,
        "../../uploads",
        String(applicationId),
        filename,
      );

      // Дополнительная проверка безопасности
      const normalizedPath = path.normalize(filePath);
      const uploadsDir = path.normalize(path.join(__dirname, "../../uploads"));
      if (!normalizedPath.startsWith(uploadsDir)) {
        return res.status(403).json({ message: "Доступ запрещен" });
      }

      if (!(await fs.pathExists(filePath))) {
        return res
          .status(404)
          .json({ message: "Файл физически не найден на сервере" });
      }

      // Находим оригинальное имя файла для скачивания
      const fileInfo = application.files.find((f) => f.stored === filename);
      const downloadName = fileInfo
        ? fileInfo.original
        : sanitizeFilename(filename);

      res.download(filePath, downloadName, (err) => {
        if (err) {
          console.error("Ошибка отправки файла:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Ошибка при скачивании файла" });
          }
        }
      });
    } catch (err) {
      console.error("Ошибка в маршруте скачивания:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Обновление заявки
router.put(
  "/applications/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  upload.array("files", 10),
  require("../middleware/cleanupTmp"),
  async (req, res) => {
    const { id } = req.params;
    const {
      name,
      organization,
      cost,
      quantity,
      comment,
      assignedAccountantId,
    } = req.body;

    try {
      const application = await Application.findByPk(id);
      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      // Проверка прав доступа
      const canEdit =
        req.user.role === "director" ||
        application.assignedAccountantId === req.user.id ||
        (req.user.role === "manager" && application.userId === req.user.id);

      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Нет прав на редактирование этой заявки" });
      }

      // Формируем обновления полей
      const updates = {};
      if (name) updates.name = name;
      if (organization) updates.organization = organization;
      if (cost) updates.cost = parseFloat(cost);
      if (quantity) updates.quantity = parseInt(quantity, 10);
      if (comment !== undefined) updates.comment = comment;

      if (assignedAccountantId) {
        if (req.user.role !== "director") {
          return res.status(403).json({
            message: "Только директор может переназначать бухгалтера",
          });
        }

        const newAccountant = await User.findByPk(assignedAccountantId);
        if (!newAccountant || newAccountant.role !== "accountant") {
          return res
            .status(400)
            .json({ message: "Неверный assignedAccountantId" });
        }
        updates.assignedAccountantId = parseInt(assignedAccountantId, 10);
      }

      // Обрабатываем новые файлы
      const existingFiles = application.files || [];
      const newFiles = [];

      if (req.files?.length > 0) {
        const uploadDir = path.join(__dirname, "../../uploads", String(id));
        await fs.ensureDir(uploadDir);

        for (const file of req.files) {
          // Генерируем уникальное имя для нового файла
          const uniqueFilename = await generateUniqueFilename(
            uploadDir,
            file.originalname,
            file.mimetype,
          );

          const originalName = sanitizeFilename(file.originalname);
          const newPath = path.join(uploadDir, uniqueFilename);

          await fs.move(file.path, newPath, { overwrite: false });

          newFiles.push({
            stored: uniqueFilename,
            original: originalName,
            size: file.size,
            mimetype: file.mimetype,
            addedAt: new Date().toISOString(),
          });
        }
      }

      // Объединяем существующие и новые файлы
      updates.files = [...existingFiles, ...newFiles];

      // Обновляем заявку
      await application.update(updates);

      // Получаем обновленную заявку
      const updatedApplication = await Application.findByPk(id, {
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email"],
          },
          {
            model: User,
            as: "AssignedAccountant",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      res.json({
        message: "Заявка обновлена",
        application: updatedApplication,
      });
    } catch (err) {
      console.error("Ошибка редактирования заявки:", err);
      res.status(500).json({
        message: "Ошибка сервера",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

// Удаление заявки (только для директора)
router.delete(
  "/applications/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    try {
      if (req.user.role !== "director") {
        return res.status(403).json({
          message: "Доступ запрещён",
          reason: "Удалять заявки может только пользователь с ролью director",
        });
      }

      const application = await Application.findByPk(id);

      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      // Удаляем файлы
      if (application.files && application.files.length > 0) {
        const uploadDir = path.join(__dirname, "../../uploads", String(id));

        try {
          await fs.remove(uploadDir);
        } catch (fsErr) {
          console.error("Ошибка при удалении файлов заявки:", fsErr);
        }
      }

      // Удаляем запись заявки из базы данных
      await application.destroy();

      res.json({
        message: "Заявка успешно удалена",
        deletedId: id,
      });
    } catch (err) {
      console.error("Ошибка при удалении заявки:", err);
      res.status(500).json({
        message: "Ошибка сервера при удалении заявки",
      });
    }
  },
);

// Получить данные текущего пользователя
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(user);
  } catch (err) {
    console.error("Ошибка в /me:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Обновление своего профиля
router.put(
  "/update/:id",
  verifyToken,
  validateProfileUpdate,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Можно обновлять только свой профиль" });
    }

    const { username, email, password } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (email) updates.email = email;
    if (password) updates.password = await bcrypt.hash(password, 10);

    try {
      const [updated] = await User.update(updates, { where: { id } });
      if (!updated) {
        return res
          .status(404)
          .json({ message: "Пользователь не найден или ничего не изменилось" });
      }

      res.json({ message: "Профиль обновлён" });
    } catch (err) {
      console.error("Ошибка обновления профиля:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Удаление своего профиля
router.delete(
  "/delete/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Можно удалить только свой аккаунт" });
    }

    try {
      const deleted = await User.destroy({ where: { id } });
      if (!deleted) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Аккаунт удалён" });
    } catch (err) {
      console.error("Ошибка удаления аккаунта:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Список всех пользователей (только для директора)
router.get(
  "/users",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "role",
          "createdAt",
          "updatedAt",
        ],
      });
      res.json(users);
    } catch (err) {
      console.error("Ошибка получения списка пользователей:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);
// Список всех бухгалтеров
router.get("/accountants", verifyToken, async (req, res) => {
  try {
    const accountant = await User.findAll({
      where: {
        role: "accountant",
      },
      attributes: ["id", "username", "email", "role", "createdAt", "updatedAt"],
    });

    res.json(accountant);
  } catch (err) {
    console.error("Ошибка получения списка бухгалтеров:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Обновление любого пользователя (только для директора)
router.put(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
  validateUserUpdate,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res
        .status(403)
        .json({ message: "Используйте /update/:id для изменения себя" });
    }

    const { username, email, password, role } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (email) updates.email = email;
    if (password) updates.password = await bcrypt.hash(password, 10);
    if (role) updates.role = role;

    try {
      const [updated] = await User.update(updates, { where: { id } });
      if (!updated) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Пользователь обновлён" });
    } catch (err) {
      console.error("Ошибка обновления пользователя:", err.errors[0].message);
      res.status(500).json({ message: err.errors[0].message });
    }
  },
);

// Удаление любого пользователя (только для директора)
router.delete(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res
        .status(403)
        .json({ message: "Нельзя удалить самого себя через этот маршрут" });
    }

    try {
      const deleted = await User.destroy({ where: { id } });
      if (!deleted) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Пользователь удалён" });
    } catch (err) {
      console.error("Ошибка удаления пользователя:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Тестовый маршрут для директора
router.get(
  "/director-only",
  verifyToken,
  roleMiddleware(["director"]),
  (req, res) => {
    res.json({ message: "Добро пожаловать, директор!" });
  },
);

module.exports = router;

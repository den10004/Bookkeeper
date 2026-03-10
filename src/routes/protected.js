const express = require("express");
const bcrypt = require("bcryptjs");
const { body, param, validationResult } = require("express-validator");
const sanitizeFilename = require("sanitize-filename");
const fs = require("fs-extra");
const path = require("path");
const Application = require("../models/application");
const verifyToken = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");
const User = require("../models/user");
const upload = require("../middleware/upload");
const { generateUniqueFilename } = require("../utils/fileUtils");
const { ROLES } = require("../constants/roles");
const router = express.Router();

// ───────────────────────────────────────────────
// ВАЛИДАТОРЫ
// ───────────────────────────────────────────────

class ValidatorFactory {
  static username(options = {}) {
    const { required = false, min = 3, max = 50 } = options;

    let validator = body("username")
      .isLength({ min, max })
      .withMessage(`Имя должно быть от ${min} до ${max} символов`)
      .matches(/^[a-zA-Zа-яА-ЯёЁ\s]+$/)
      .withMessage("Имя может содержать только буквы и пробелы")
      .escape();

    if (required) {
      validator = validator.notEmpty().withMessage("Имя обязательно");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static email(options = {}) {
    const { required = false } = options;

    let validator = body("email")
      .trim()
      .isEmail()
      .withMessage("Некорректный формат email")
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage("Email слишком длинный");

    if (required) {
      validator = validator.notEmpty().withMessage("Email обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static password(options = {}) {
    const { required = false, min = 6, max = 100 } = options;

    let validator = body("password")
      .isLength({ min, max })
      .withMessage(`Пароль должен быть от ${min} до ${max} символов`)
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("Пароль должен содержать хотя бы одну букву и одну цифру");

    if (required) {
      validator = validator.notEmpty().withMessage("Пароль обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static role(options = {}) {
    const { required = false } = options;

    let validator = body("role")
      .isIn([ROLES.ACCOUNTANT, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.ROP])
      .withMessage("Недопустимая роль");

    if (required) {
      validator = validator.notEmpty().withMessage("Роль обязательна");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static id(paramName = "id", required = true) {
    let validator = param(paramName)
      .isInt({ min: 1 })
      .withMessage(`ID должен быть положительным целым числом`);

    if (required) {
      validator = validator.notEmpty().withMessage("ID обязателен");
    }

    return validator.toInt();
  }

  static applicationId() {
    return param("applicationId")
      .isInt({ min: 1 })
      .withMessage("Некорректный ID заявки")
      .toInt();
  }

  static filename() {
    return param("filename")
      .notEmpty()
      .isString()
      .withMessage("Имя файла должно быть строкой")
      .custom((value) => {
        if (!/^[a-zA-Z0-9а-яА-ЯёЁ\s._-]+$/.test(value)) {
          throw new Error("Имя файла содержит недопустимые символы");
        }
        return true;
      });
  }

  static applicationName(options = {}) {
    const { required = true, min = 2, max = 200 } = options;

    let validator = body("name")
      .isLength({ min, max })
      .withMessage(`Название должно быть от ${min} до ${max} символов`)
      .escape();

    if (required) {
      validator = validator.notEmpty().withMessage("Название обязательно");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static organization(options = {}) {
    const { required = true, min = 2, max = 100 } = options;

    let validator = body("organization")
      .isLength({ min, max })
      .withMessage(
        `Название организации должно быть от ${min} до ${max} символов`,
      )
      .escape();

    if (required) {
      validator = validator
        .notEmpty()
        .withMessage("Название организации обязательно");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static cost(options = {}) {
    const { required = true, min = 0.01, max = 9999999.99 } = options;

    let validator = body("cost")
      .isFloat({ min, max })
      .withMessage(`Стоимость должна быть от ${min} до ${max.toLocaleString()}`)
      .toFloat();

    if (required) {
      validator = validator.notEmpty().withMessage("Стоимость обязательна");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static quantity(options = {}) {
    const { required = true, min = 1, max = 999999 } = options;

    let validator = body("quantity")
      .isInt({ min, max })
      .withMessage(`Количество должно быть от ${min} до ${max}`)
      .toInt();

    if (required) {
      validator = validator.notEmpty().withMessage("Количество обязательно");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static comment(options = {}) {
    const { max = 1000 } = options;

    return body("comment")
      .optional()
      .isLength({ max })
      .withMessage(`Комментарий не должен превышать ${max} символов`)
      .escape();
  }

  static assignedAccountantId(options = {}) {
    const { required = true } = options;

    let validator = body("assignedAccountantId")
      .isInt({ min: 1 })
      .withMessage("Некорректный ID бухгалтера")
      .toInt();

    if (required) {
      validator = validator.notEmpty().withMessage("ID бухгалтера обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static requestType(options = {}) {
    const { required = true } = options;

    let validator = body("requestType")
      .isIn(["new_client", "existing_client", "document_request"])
      .withMessage("Некорректный тип запроса");

    if (required) {
      validator = validator.notEmpty().withMessage("Тип запроса обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }
  static documentType(options = {}) {
    const { required = false } = options;

    let validator = body("documentType")
      .isIn(["work_certificate", "reconciliation_act"])
      .withMessage(
        "Тип документа должен быть 'Акт выполненных работ' или 'Акт сверки'",
      );

    if (required) {
      validator = validator.notEmpty().withMessage("Тип документа обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static inn(options = {}) {
    const { required = false } = options;

    let validator = body("inn")
      .matches(/^\d{10}$|^\d{12}$/)
      .withMessage("ИНН должен содержать 10 или 12 цифр");

    if (required) {
      validator = validator.notEmpty().withMessage("ИНН обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static accountNumber(options = {}) {
    const { required = false, max = 20 } = options;

    let validator = body("accountNumber")
      .isLength({ max })
      .withMessage(`Номер счёта не должен превышать ${max} символов`)
      .matches(/^[a-zA-Z0-9-]+$/)
      .withMessage("Номер счёта может содержать только буквы, цифры и дефис");

    if (required) {
      validator = validator.notEmpty().withMessage("Номер счёта обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static periodDate(fieldName) {
    return body(fieldName)
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (!value || value === "") {
          return true;
        }

        const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
        if (!datePattern.test(value)) {
          throw new Error(`${fieldName} должен быть в формате ДД.ММ.ГГГГ`);
        }

        const [day, month, year] = value.split(".");
        const date = new Date(`${year}-${month}-${day}`);
        if (isNaN(date.getTime())) {
          throw new Error(`${fieldName} содержит невалидную дату`);
        }

        return true;
      })
      .customSanitizer((value) => {
        if (!value || value === "") return null;

        // Преобразование из ДД.ММ.ГГГГ в ГГГГ-ММ-ДД для БД
        const [day, month, year] = value.split(".");
        return `${year}-${month}-${day}`;
      });
  }

  static documentFormat(options = {}) {
    const { required = false } = options;

    let validator = body("documentFormat")
      .isIn(["pdf", "edo"])
      .withMessage("Формат должен быть 'PDF' или 'ЭДО'");

    if (required) {
      validator = validator
        .notEmpty()
        .withMessage("Формат документа обязателен");
    } else {
      validator = validator.optional();
    }

    return validator;
  }

  static totalAmount(options = {}) {
    const { required = false, min = 0.01, max = 9999999.99 } = options;

    let validator = body("totalAmount")
      .isFloat({ min, max })
      .withMessage(
        `Итоговая сумма должна быть от ${min} до ${max.toLocaleString()}`,
      )
      .toFloat();

    if (required) {
      validator = validator
        .notEmpty()
        .withMessage("Итоговая сумма обязательна");
    } else {
      validator = validator.optional();
    }

    return validator;
  }
}

// ───────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ───────────────────────────────────────────────

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    const errorMessage = firstError.path ? `${firstError.msg}` : firstError.msg;

    return res.status(400).json({
      message: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? errors.array() : undefined,
    });
  }
  next();
};

// ───────────────────────────────────────────────
// КОМБИНИРОВАННЫЕ ВАЛИДАЦИИ
// ───────────────────────────────────────────────

const validateIdParam = [ValidatorFactory.id("id")];

const validateUserCreate = [
  ValidatorFactory.username({ required: true }),
  ValidatorFactory.email({ required: true }),
  ValidatorFactory.password({ required: true }),
  ValidatorFactory.role({ required: true }),
];

const validateApplicationCreate = [
  ValidatorFactory.applicationName({ required: true }),
  ValidatorFactory.organization({ required: true }),
  ValidatorFactory.cost({ required: false }),
  ValidatorFactory.quantity({ required: false }),
  ValidatorFactory.requestType({ required: true }),
  ValidatorFactory.comment(),
  ValidatorFactory.assignedAccountantId({ required: true }),

  body().custom((value, { req }) => {
    const { requestType } = req.body;

    if (requestType === "document_request") {
      const requiredFields = [
        "documentType",
        "inn",
        "accountNumber",
        "periodFrom",
        "periodTo",
        "documentFormat",
        "totalAmount",
      ];

      for (const field of requiredFields) {
        if (!req.body[field] || req.body[field] === "") {
          throw new Error(`Поле ${field} обязательно для document_request`);
        }
      }
    } else {
      if (!req.body.cost) {
        throw new Error(
          "Для данного типа запроса необходимо указать стоимость",
        );
      }
      if (!req.body.quantity) {
        throw new Error(
          "Для данного типа запроса необходимо указать количество",
        );
      }
    }
    return true;
  }),

  ValidatorFactory.documentType({ required: false }),
  ValidatorFactory.inn({ required: false }),
  ValidatorFactory.accountNumber({ required: false }),
  ValidatorFactory.periodDate("periodFrom"),
  ValidatorFactory.periodDate("periodTo"),
  ValidatorFactory.documentFormat({ required: false }),
  ValidatorFactory.totalAmount({ required: false }),

  ValidatorFactory.cost({ required: false }),
  ValidatorFactory.quantity({ required: false }),
];

const validateDownload = [
  ValidatorFactory.applicationId(),
  ValidatorFactory.filename(),
];

const validateProfileUpdate = [
  ValidatorFactory.id(),
  ValidatorFactory.username({ required: false }),
  ValidatorFactory.email({ required: false }),
  ValidatorFactory.password({ required: false }),
];

const validateUserUpdate = [
  ValidatorFactory.id(),
  ValidatorFactory.username({ required: false }),
  ValidatorFactory.email({ required: false }),
  ValidatorFactory.password({ required: false }),
  ValidatorFactory.role({ required: false }),
];

// ───────────────────────────────────────────────
// МАРШРУТЫ
// ───────────────────────────────────────────────

// Регистрация пользователя (только для директора)
router.post(
  "/users",
  verifyToken,
  roleMiddleware([ROLES.DIRECTOR, ROLES.ROP]),
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

// Создание заявки (только для менеджера, роп)
router.post(
  "/applications",
  verifyToken,
  roleMiddleware([ROLES.MANAGER, ROLES.ROP]),
  upload.array("files", 10),

  (req, res, next) => {
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        if (file.originalname) {
          try {
            const buffer = Buffer.from(file.originalname, "latin1");
            const corrected = buffer.toString("utf8");
            if (
              /[а-яёА-ЯЁ]/.test(corrected) &&
              corrected !== file.originalname
            ) {
              file.originalname = corrected;
            }
          } catch (err) {
            console.warn(
              `Не удалось исправить кодировку имени: ${file.originalname}`,
              err,
            );
          }
        }
      });
    }
    next();
  },
  require("../middleware/cleanupTmp"),
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
      requestType,
    } = req.body;

    let application = null;

    try {
      const accountant = await User.findByPk(assignedAccountantId);
      if (!accountant || accountant.role !== ROLES.ACCOUNTANT) {
        return res.status(400).json({
          message:
            "assignedAccountantId должен ссылаться на пользователя с ролью бухгалтер",
        });
      }
      const applicationData = {
        name,
        organization,
        userId: req.user.id,
        assignedAccountantId: parseInt(assignedAccountantId, 10),
        requestType,
        comment: comment || null,
      };

      if (requestType === "document_request") {
        applicationData.cost = null;
        applicationData.quantity = null;
        applicationData.documentType = req.body.documentType;
        applicationData.inn = req.body.inn;
        applicationData.accountNumber = req.body.accountNumber;
        applicationData.periodFrom = req.body.periodFrom;
        applicationData.periodTo = req.body.periodTo;
        applicationData.documentFormat = req.body.documentFormat;
        applicationData.totalAmount = parseFloat(req.body.totalAmount);
      } else {
        applicationData.cost = parseFloat(cost);
        applicationData.quantity = parseInt(quantity, 10);
        applicationData.documentType = null;
        applicationData.inn = null;
        applicationData.accountNumber = null;
        applicationData.periodFrom = null;
        applicationData.periodTo = null;
        applicationData.documentFormat = null;
        applicationData.totalAmount = null;
      }

      application = await Application.create(applicationData, {
        userId: req.user.id,
      });

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
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

      const fullApplication = await Application.findByPk(application.id, {
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
      });

      res.status(201).json({
        message: "Заявка успешно создана",
        application: {
          id: application.id,
          name: application.name,
          organization: application.organization,
          requestType: application.requestType,
          cost: application.cost ? Number(application.cost) : null,
          quantity: application.quantity ? Number(application.quantity) : null,
          documentType: application.documentType,
          inn: application.inn,
          accountNumber: application.accountNumber,
          periodFrom: application.periodFrom,
          periodTo: application.periodTo,
          documentFormat: application.documentFormat,
          totalAmount: application.totalAmount
            ? Number(application.totalAmount)
            : null,
          comment: application.comment,
          assignedAccountantId: Number(application.assignedAccountantId),
          files: application.downloadLinks || [],
          createdAt: application.createdAt.toISOString(),
        },
      });

      const { io } = require("../server");
      io.emit("application:created", fullApplication.get({ plain: true }));
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

router.get("/applications", verifyToken, async (req, res) => {
  try {
    const commonInclude = [
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
    ];

    const order = [["createdAt", "DESC"]];

    let where = {};

    if (req.user.role === ROLES.DIRECTOR || ROLES.ROP) {
    } else if (req.user.role === ROLES.ACCOUNTANT) {
      where = { assignedAccountantId: req.user.id };
    } else if (req.user.role === ROLES.MANAGER) {
      where = { userId: req.user.id };
    } else {
      return res.status(403).json({ message: "Нет прав для просмотра заявок" });
    }

    const applications = await Application.findAll({
      where,
      include: commonInclude,
      order,
    });

    res.json(applications);
  } catch (err) {
    console.error("Ошибка при получении заявок:", err);
    res.status(500).json({
      message: "Ошибка сервера при получении заявок",
      error: err.message,
    });
  }
});

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
        req.user.role === ROLES.DIRECTOR ||
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

      const fileExists = application.files.some((f) => f.stored === filename);
      if (!fileExists) {
        return res.status(404).json({ message: "Файл не найден в заявке" });
      }

      const canAccess =
        req.user.role === ROLES.DIRECTOR ||
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

router.put(
  "/applications/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  upload.array("files", 10),

  (req, res, next) => {
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        if (file.originalname) {
          try {
            const buffer = Buffer.from(file.originalname, "latin1");
            const corrected = buffer.toString("utf8");

            if (
              /[а-яёА-ЯЁ]/.test(corrected) &&
              corrected !== file.originalname
            ) {
              file.originalname = corrected;
            }
          } catch (err) {
            console.warn(
              `Не удалось исправить кодировку (update): ${file.originalname}`,
              err,
            );
          }
        }
      });
    }
    next();
  },
  require("../middleware/cleanupTmp"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const application = await Application.findByPk(id);
      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      const canEdit =
        req.user.role === ROLES.DIRECTOR ||
        req.user.role === ROLES.ROP ||
        application.assignedAccountantId === req.user.id ||
        (req.user.role === ROLES.MANAGER && application.userId === req.user.id);

      if (!canEdit) {
        return res.status(403).json({ message: "Нет прав на редактирование" });
      }

      const updates = {
        updatedBy: req.user.id,
        updatedAt: new Date(),
      };
      const { requestType } = req.body;

      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.organization !== undefined)
        updates.organization = req.body.organization;
      if (req.body.comment !== undefined) updates.comment = req.body.comment;

      if (
        req.body.assignedAccountantId !== undefined &&
        (req.user.role === ROLES.DIRECTOR || req.user.role === ROLES.ROP)
      ) {
        if (req.body.assignedAccountantId) {
          const newAccountant = await User.findByPk(
            req.body.assignedAccountantId,
          );
          if (!newAccountant || newAccountant.role !== ROLES.ACCOUNTANT) {
            return res.status(400).json({ message: "Неверный ID бухгалтера" });
          }
          updates.assignedAccountantId = parseInt(
            req.body.assignedAccountantId,
            10,
          );
        } else {
          updates.assignedAccountantId = null;
        }
      }

      const isDocumentRequest =
        application.requestType === "document_request" ||
        requestType === "document_request";

      if (isDocumentRequest) {
        if (req.body.documentType !== undefined)
          updates.documentType = req.body.documentType;
        if (req.body.inn !== undefined) updates.inn = req.body.inn;
        if (req.body.accountNumber !== undefined)
          updates.accountNumber = req.body.accountNumber;

        if (req.body.periodFrom) {
          const [day, month, year] = req.body.periodFrom.split(".");
          updates.periodFrom = `${year}-${month}-${day}`;
        }
        if (req.body.periodTo) {
          const [day, month, year] = req.body.periodTo.split(".");
          updates.periodTo = `${year}-${month}-${day}`;
        }

        if (req.body.documentFormat !== undefined)
          updates.documentFormat = req.body.documentFormat;
        if (req.body.totalAmount !== undefined)
          updates.totalAmount = parseFloat(req.body.totalAmount);

        updates.cost = null;
        updates.quantity = null;
      } else {
        if (req.body.cost !== undefined)
          updates.cost = parseFloat(req.body.cost);
        if (req.body.quantity !== undefined)
          updates.quantity = parseInt(req.body.quantity, 10);

        updates.documentType = null;
        updates.inn = null;
        updates.accountNumber = null;
        updates.periodFrom = null;
        updates.periodTo = null;
        updates.documentFormat = null;
        updates.totalAmount = null;
      }

      if (req.files?.length > 0) {
        const uploadDir = path.join(process.cwd(), "uploads", String(id));
        await fs.ensureDir(uploadDir);

        const existingFiles = application.files || [];
        const newFiles = [];

        for (const file of req.files) {
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

        updates.files = [...existingFiles, ...newFiles];
      }

      const { APPLICATION_STATUSES } = require("../models/application");

      const hasChanges = Object.keys(updates).some(
        (key) =>
          key !== "updatedBy" &&
          key !== "updatedAt" &&
          key !== "status" &&
          key !== "statusComment",
      );

      if (req.body.status) {
        if (Object.values(APPLICATION_STATUSES).includes(req.body.status)) {
          updates.status = req.body.status;
          if (req.body.statusComment) {
            updates.statusComment = req.body.statusComment;
          }
          console.log(
            `📌 Явное изменение статуса: ${application.status} -> ${req.body.status}`,
          );
        } else {
          return res.status(400).json({
            message:
              "Некорректный статус. Допустимые значения: " +
              Object.values(APPLICATION_STATUSES).join(", "),
          });
        }
      }
      // Автоматическое обновление статуса
      else if (hasChanges) {
        updates.status = APPLICATION_STATUSES.UPDATED;
        updates.statusComment = "Заявка обновлена через редактирование";
      }

      await application.update(updates, {
        userId: req.user.id,
        individualHooks: true,
      });

      const updatedApplication = await Application.findByPk(id, {
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
          {
            model: User,
            as: "Updater",
            attributes: ["id", "username", "email", "role"],
          },
        ],
      });

      res.json({
        message: "Заявка успешно обновлена",
        application: updatedApplication,
      });

      // Socket события
      try {
        const { io } = require("../server");
        if (io) {
          const appJson = updatedApplication.toJSON();

          if (!appJson.Updater && req.user) {
            appJson.Updater = {
              id: req.user.id,
              username: req.user.username,
              email: req.user.email,
              role: req.user.role,
            };
          }

          io.emit("application:updated", appJson);

          if (updates.status && updates.status !== application.status) {
            io.emit("application:statusChanged", {
              applicationId: id,
              oldStatus: application.status,
              newStatus: updates.status,
              changedBy: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role,
              },
              comment: updates.statusComment || "Статус изменён",
              timestamp: new Date().toISOString(),
              application: appJson,
            });
          }
        }
      } catch (socketError) {
        console.error("❌ Ошибка при отправке сокет-события:", socketError);
      }
    } catch (err) {
      console.error("❌ Ошибка обновления заявки:", err);
      console.error("Stack:", err.stack);
      res.status(500).json({
        message: "Ошибка сервера",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

router.delete(
  "/applications/:id",
  verifyToken,
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    try {
      if (req.user.role !== ROLES.DIRECTOR && req.user.role !== ROLES.ROP) {
        return res.status(403).json({
          message: "Доступ запрещён",
          reason:
            "Удалять заявки может только пользователь с ролью директор или РОП",
        });
      }
      const application = await Application.findByPk(id);

      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      const applicationName = application.name || "Без названия";

      if (application.files && application.files.length > 0) {
        const uploadDir = path.join(process.cwd(), "uploads", String(id));
        try {
          await fs.remove(uploadDir);
        } catch (fsErr) {
          console.error("Ошибка при удалении файлов заявки:", fsErr);
        }
      }

      await application.destroy();

      try {
        const { io } = require("../server");
        if (io) {
          const payload = {
            id: String(id),
            name: applicationName,
            deletedBy: req.user.id,
            deletedByUsername: req.user.username,
            timestamp: new Date().toISOString(),
          };

          io.emit("application:deleted", payload);
        } else {
          console.error("Socket.io не найден");
        }
      } catch (socketError) {
        console.error("Ошибка при отправке сокет-события:", socketError);
      }

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

// Список всех пользователей
router.get(
  "/users",
  verifyToken,
  // roleMiddleware([ROLES.DIRECTOR, ROLES.ROP]),
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
  roleMiddleware([ROLES.DIRECTOR, ROLES.ROP]),
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
  roleMiddleware([ROLES.DIRECTOR, ROLES.ROP]),
  validateIdParam,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res
        .status(403)
        .json({ message: "Директор не может удалить сам себя" });
    }

    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      if (user.role === ROLES.DIRECTOR && req.user.role !== ROLES.ROP) {
        return res
          .status(403)
          .json({ message: "Нельзя удалить другого директора" });
      }

      await user.destroy();

      res.json({
        message: "Пользователь успешно удалён",
        deletedUser: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("Ошибка удаления пользователя:", err);
      res
        .status(500)
        .json({ message: "Ошибка сервера при удалении пользователя" });
    }
  },
);

// все статусы
router.get("/statuses", verifyToken, (req, res) => {
  const { APPLICATION_STATUSES } = require("../models/application");
  res.json({
    statuses: Object.values(APPLICATION_STATUSES),
    labels: {
      new: "Новая",
      updated: "Обновлена",
      accepted: "Принята",
      in_progress: "В работе",
      completed: "Завершена",
      rejected: "Отклонена",
    },
  });
});

// Обновление статуса заявки
router.patch(
  "/applications/:id/status",
  verifyToken,
  upload.none(),
  [
    ValidatorFactory.id("id"),
    body("status")
      .isIn(
        Object.values(require("../models/application").APPLICATION_STATUSES),
      )
      .withMessage("Некорректный статус"),
    body("comment")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Комментарий не должен превышать 500 символов")
      .escape(),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const { status, comment } = req.body;

    try {
      const application = await Application.findByPk(id);

      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }
      const canChangeStatus =
        req.user.role === ROLES.DIRECTOR ||
        req.user.role === ROLES.ROP ||
        application.assignedAccountantId === req.user.id ||
        (req.user.role === ROLES.MANAGER && application.userId === req.user.id);

      if (!canChangeStatus) {
        return res.status(403).json({
          message: "Нет прав для изменения статуса этой заявки",
        });
      }

      const oldStatus = application.status;

      const updateData = {
        status,
        updatedBy: req.user.id,
      };

      if (comment) {
        updateData.statusComment = comment;
      }

      await application.update(updateData, {
        userId: req.user.id,
        individualHooks: true,
      });

      const updatedApplication = await Application.findByPk(id, {
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
      });

      try {
        const { io } = require("../server");
        if (io) {
          io.emit("application:statusChanged", {
            applicationId: id,
            oldStatus,
            newStatus: status,
            changedBy: {
              id: req.user.id,
              username: req.user.username,
              role: req.user.role,
            },
            comment: comment || null,
            timestamp: new Date().toISOString(),
            application: updatedApplication,
          });
        }
      } catch (socketError) {
        console.error("Ошибка при отправке сокет-события:", socketError);
      }

      res.json({
        message: "Статус заявки успешно обновлён",
        application: updatedApplication,
        statusChanged: {
          from: oldStatus,
          to: status,
          by: req.user.username,
          comment: comment || null,
        },
      });
    } catch (err) {
      console.error("Ошибка при обновлении статуса заявки:", err);
      res.status(500).json({
        message: "Ошибка сервера при обновлении статуса",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

// Получение истории статусов заявки
router.get(
  "/applications/:id/status-history",
  verifyToken,
  ValidatorFactory.id("id"),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;

    try {
      const application = await Application.findByPk(id, {
        attributes: ["id", "status", "statusHistory", "updatedAt"],
        include: [
          {
            model: User,
            as: "Creator",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      const canView =
        req.user.role === ROLES.DIRECTOR ||
        req.user.role === ROLES.ROP ||
        application.Creator?.id === req.user.id ||
        application.assignedAccountantId === req.user.id;

      if (!canView) {
        return res.status(403).json({
          message: "Нет доступа к истории статусов этой заявки",
        });
      }

      const history = application.statusHistory || [];

      res.json({
        applicationId: id,
        currentStatus: application.status,
        history: history,
        lastUpdated: application.updatedAt,
      });
    } catch (err) {
      console.error("Ошибка при получении истории статусов:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Массовое обновление статусов (для бухгалтера/директора/роп)
router.patch(
  "/applications/bulk-status",
  verifyToken,
  roleMiddleware([ROLES.DIRECTOR, ROLES.ROP, ROLES.ACCOUNTANT]),
  [
    body("applicationIds")
      .isArray({ min: 1 })
      .withMessage("Необходимо указать хотя бы один ID заявки"),
    body("applicationIds.*")
      .isInt({ min: 1 })
      .withMessage("Некорректный ID заявки"),
    body("status")
      .isIn(
        Object.values(require("../models/application").APPLICATION_STATUSES),
      )
      .withMessage("Некорректный статус"),
    body("comment")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Комментарий не должен превышать 500 символов"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { applicationIds, status, comment } = req.body;

    try {
      const whereClause = {
        id: applicationIds,
      };

      if (req.user.role === ROLES.ACCOUNTANT) {
        whereClause.assignedAccountantId = req.user.id;
      } else if (req.user.role === ROLES.MANAGER) {
        whereClause.userId = req.user.id;
      }

      const applications = await Application.findAll({
        where: whereClause,
      });

      if (applications.length === 0) {
        return res.status(404).json({
          message: "Не найдено заявок для обновления",
        });
      }

      const updatedApplications = [];
      const errors = [];

      for (const application of applications) {
        try {
          const oldStatus = application.status;

          await application.update(
            {
              status,
              updatedBy: req.user.id,
              statusComment: comment,
            },
            {
              userId: req.user.id,
              individualHooks: true,
            },
          );

          updatedApplications.push({
            id: application.id,
            oldStatus,
            newStatus: status,
          });
        } catch (err) {
          errors.push({
            id: application.id,
            error: err.message,
          });
        }
      }

      try {
        const { io } = require("../server");
        if (io && updatedApplications.length > 0) {
          io.emit("applications:bulkStatusChanged", {
            count: updatedApplications.length,
            status,
            changedBy: {
              id: req.user.id,
              username: req.user.username,
              role: req.user.role,
            },
            comment: comment || null,
            applications: updatedApplications,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (socketError) {
        console.error("Ошибка при отправке сокет-события:", socketError);
      }

      res.json({
        message: `Обновлено ${updatedApplications.length} заявок`,
        updated: updatedApplications,
        errors: errors.length > 0 ? errors : undefined,
        totalProcessed: applications.length,
      });
    } catch (err) {
      console.error("Ошибка при массовом обновлении статусов:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

router.get(
  "/director-only",
  verifyToken,
  roleMiddleware([ROLES.DIRECTOR]),
  (req, res) => {
    res.json({ message: "Добро пожаловать, директор!" });
  },
);

module.exports = router;

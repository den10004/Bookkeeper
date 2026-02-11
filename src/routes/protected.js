const express = require("express");
const verifyToken = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");
const User = require("../models/user");
const fs = require("fs-extra");
const path = require("path");
const Application = require("../models/application");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const router = express.Router();

const upload = multer({
  dest: "tmp/", // временная папка
  limits: { fileSize: 10 * 1024 * 1024 }, // лимит 10 МБ на файл
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Недопустимый тип файла. Разрешены: jpg, png, pdf, doc, docx",
        ),
      );
    }
  },
});

// Создание заявки — только менеджер
router.post(
  "/applications",
  verifyToken,
  roleMiddleware(["manager"]),
  upload.array("files", 10), // до 10 файлов, имя поля в форме — files
  async (req, res) => {
    const {
      name,
      organization,
      cost,
      quantity,
      comment,
      assignedAccountantId,
    } = req.body;

    // Простая валидация
    if (!name || !organization || !cost || !quantity || !assignedAccountantId) {
      return res.status(400).json({
        message:
          "Обязательные поля: name, organization, cost, quantity, assignedAccountantId",
      });
    }

    try {
      const accountant = await User.findByPk(assignedAccountantId);
      if (!accountant || accountant.role !== "accountant") {
        return res.status(400).json({
          message:
            "assignedAccountantId должен ссылаться на пользователя с ролью accountant",
        });
      }
      const application = await Application.create({
        name,
        organization,
        cost: parseFloat(cost),
        quantity: parseInt(quantity, 10),
        comment: comment || null,
        userId: req.user.id,
        assignedAccountantId: parseInt(assignedAccountantId, 10),
      });

      // Папка для файлов этой заявки: uploads/<id заявки>
      const uploadDir = path.join(
        __dirname,
        "../../uploads",
        application.id.toString(),
      );
      await fs.ensureDir(uploadDir);

      // Массив имён файлов для сохранения в БД
      const savedFiles = [];

      // Обрабатываем загруженные файлы
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const originalName = file.originalname;
          const newPath = path.join(uploadDir, originalName);

          // Перемещаем файл из tmp в нужную папку
          await fs.move(file.path, newPath, { overwrite: true });

          savedFiles.push(originalName);
        }
      }

      // Сохраняем список файлов в заявку
      await application.update({ files: savedFiles });

      // Ссылки для скачивания
      const downloadLinks = savedFiles.map(
        (file) =>
          `/protected/download/${application.id}/${encodeURIComponent(file)}`,
      );

      res.status(201).json({
        message: "Заявка создана",
        application: {
          id: application.id,
          name,
          organization,
          cost: application.cost,
          quantity: application.quantity,
          comment,
          assignedAccountantId: application.assignedAccountantId,
          files: downloadLinks,
        },
      });
    } catch (err) {
      console.error("Ошибка при создании заявки:", err);
      res.status(500).json({ message: "Ошибка сервера при создании заявки" });
    }
  },
);

router.get("/applications", verifyToken, async (req, res) => {
  try {
    let applications;

    if (req.user.role === "director") {
      // Директор видит ВСЕ заявки
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
      // Бухгалтер видит ТОЛЬКО те заявки, которые адресованы именно ему
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
      // Менеджер видит только свои созданные заявки
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

    // Если ничего не найдено — возвращаем пустой массив
    res.json(applications || []);
  } catch (err) {
    console.error("Ошибка при получении заявок:", err);
    res.status(500).json({
      message: "Ошибка сервера при получении заявок",
      error: err.message,
    });
  }
});

router.get("/applications/:id", verifyToken, async (req, res) => {
  try {
    const application = await Application.findByPk(req.params.id, {
      include: [
        { model: User, as: "Creator", attributes: ["id", "username", "email"] },
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
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ───────────────────────────────────────────────
// 1. Получить данные текущего пользователя (о себе)
// ───────────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] }, // не отдаём пароль
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

// ───────────────────────────────────────────────
// 2. Обновление своего профиля (доступно всем авторизованным)
// ───────────────────────────────────────────────
router.put("/update/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  // Можно обновлять только свой аккаунт
  if (parseInt(id) !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Можно обновлять только свой профиль" });
  }

  const { username, email, password, role } = req.body;
  const updates = {};

  if (username) updates.username = username;
  if (email) updates.email = email;
  if (password) updates.password = await bcrypt.hash(password, 10);
  // role обычно не дают менять самому себе — убираем или оставляем под контролем
  // if (role && ['accountant', 'director', 'manager'].includes(role)) updates.role = role;

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
});

// ───────────────────────────────────────────────
// 3. Удаление своего профиля
// ───────────────────────────────────────────────
router.delete("/delete/:id", verifyToken, async (req, res) => {
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
});

// ───────────────────────────────────────────────
// 4. Список всех пользователей — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
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

// ───────────────────────────────────────────────
// 5. Обновление любого пользователя — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
router.put(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    const { id } = req.params;

    // Нельзя редактировать самого себя через этот маршрут (для безопасности)
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
    if (role && ["accountant", "director", "manager"].includes(role)) {
      updates.role = role;
    }

    try {
      const [updated] = await User.update(updates, { where: { id } });
      if (!updated) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: "Пользователь обновлён" });
    } catch (err) {
      console.error("Ошибка обновления пользователя:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// ───────────────────────────────────────────────
// 6. Удаление любого пользователя — ТОЛЬКО ДЛЯ DIRECTOR
// ───────────────────────────────────────────────
router.delete(
  "/users/:id",
  verifyToken,
  roleMiddleware(["director"]),
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

router.get(
  "/director-only",
  verifyToken,
  roleMiddleware(["director"]),
  (req, res) => {
    res.json({ message: "Добро пожаловать, директор!" });
  },
);

module.exports = router;

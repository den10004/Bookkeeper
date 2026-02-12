const express = require("express");
const verifyToken = require("../middleware/auth");
const roleMiddleware = require("../middleware/role");
const User = require("../models/user");
const fs = require("fs-extra");
const path = require("path");
const Application = require("../models/application");
const bcrypt = require("bcryptjs");
const upload = require("../middleware/upload");
const router = express.Router();

// ───────────────────────────────────────────────
// Регистрация
// ───────────────────────────────────────────────

router.post(
  "/users",
  verifyToken,
  roleMiddleware(["director"]),
  async (req, res) => {
    const { username, password, role, email } = req.body;

    // Валидация
    if (!username || !password || !role) {
      return res.status(400).json({
        message: "Обязательные поля: username, password, role",
      });
    }

    if (!["accountant", "director", "manager"].includes(role)) {
      return res.status(400).json({
        message: "Недопустимая роль. Допустимые: accountant, director, manager",
      });
    }

    try {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "Пользователь с таким username уже существует" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username,
        password: hashedPassword,
        role,
        email: email || null, // если добавите поле email в модель
      });

      // Не возвращаем пароль!
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
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

// ───────────────────────────────────────────────
// 1. Заявки
// ───────────────────────────────────────────────
router.post(
  "/applications",
  verifyToken,
  roleMiddleware(["manager"]),
  upload.array("files", 10),
  require("../middleware/cleanupTmp"),
  async (req, res) => {
    const {
      name,
      organization,
      cost,
      quantity,
      comment,
      assignedAccountantId,
    } = req.body;

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

      const uploadDir = path.join(
        __dirname,
        "../../uploads",
        String(application.id),
      );
      await fs.ensureDir(uploadDir);

      const savedFiles = [];

      if (req.files?.length > 0) {
        for (const file of req.files) {
          const originalName = file.originalname;
          const newPath = path.join(uploadDir, originalName);

          await fs.move(file.path, newPath, { overwrite: true });
          savedFiles.push(originalName);
        }
      }

      await application.update({ files: savedFiles });

      const downloadLinks = savedFiles.map(
        (file) =>
          `/protected/download/${application.id}/${encodeURIComponent(file)}`,
      );

      res.status(201).json({
        message: "Заявка успешно создана",
        application: {
          id: application.id,
          name: application.name,
          organization: application.organization,
          cost: Number(application.cost),
          quantity: application.quantity,
          comment: application.comment,
          assignedAccountantId: application.assignedAccountantId,
          files: downloadLinks,
          createdAt: application.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.error("Ошибка при создании заявки:", err);
      res.status(500).json({
        message: "Ошибка сервера при создании заявки",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

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
router.get(
  "/download/:applicationId/:filename",
  verifyToken,
  async (req, res) => {
    const { applicationId, filename } = req.params;

    try {
      const application = await Application.findByPk(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Заявка не найдена" });
      }

      if (!application.files.includes(filename)) {
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
        applicationId,
        filename,
      );

      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json({ message: "Файл физически не найден на сервере" });
      }

      res.download(filePath, filename, (err) => {
        if (err) {
          console.error("Ошибка отправки файла:", err);
          res.status(500).json({ message: "Ошибка при скачивании файла" });
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
  upload.array("files", 10), // позволяет добавлять новые файлы
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
        req.user.role === "director" || // директор может всё
        application.assignedAccountantId === req.user.id || // назначенный бухгалтер
        (req.user.role === "manager" && application.userId === req.user.id); // создатель (опционально)

      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Нет прав на редактирование этой заявки" });
      }

      // Формируем обновления полей (только если переданы)
      const updates = {};
      if (name) updates.name = name;
      if (organization) updates.organization = organization;
      if (cost) updates.cost = parseFloat(cost);
      if (quantity) updates.quantity = parseInt(quantity, 10);
      if (comment) updates.comment = comment;
      if (assignedAccountantId) {
        // Проверка нового бухгалтера
        const newAccountant = await User.findByPk(assignedAccountantId);
        if (!newAccountant || newAccountant.role !== "accountant") {
          return res
            .status(400)
            .json({ message: "Неверный assignedAccountantId" });
        }
        updates.assignedAccountantId = parseInt(assignedAccountantId, 10);
      }

      // Добавляем новые файлы (расширяем существующий массив)
      const existingFiles = application.files || [];
      const newFiles = [];
      if (req.files?.length > 0) {
        const uploadDir = path.join(__dirname, "../../uploads", String(id));
        await fs.ensureDir(uploadDir);

        for (const file of req.files) {
          const originalName = file.originalname;
          const newPath = path.join(uploadDir, originalName);
          await fs.move(file.path, newPath, { overwrite: true });
          newFiles.push(originalName);
        }
      }

      // Обновляем заявку
      updates.files = [...existingFiles, ...newFiles];
      await application.update(updates);

      // Формируем ссылки для всех файлов
      const allFiles = application.files;
      const downloadLinks = allFiles.map(
        (file) =>
          `/protected/download/${application.id}/${encodeURIComponent(file)}`,
      );

      res.json({
        message: "Заявка обновлена",
        application: {
          id: application.id,
          name: application.name,
          organization: application.organization,
          cost: application.cost,
          quantity: application.quantity,
          comment: application.comment,
          assignedAccountantId: application.assignedAccountantId,
          files: downloadLinks,
          updatedAt: application.updatedAt,
        },
      });
    } catch (err) {
      console.error("Ошибка редактирования заявки:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// ───────────────────────────────────────────────
// УДАЛЕНИЕ заявки — ТОЛЬКО ДЛЯ DIRECTOR
// DELETE /protected/applications/:id
// ───────────────────────────────────────────────
router.delete("/applications/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const applicationId = parseInt(id, 10);
    if (isNaN(applicationId)) {
      return res.status(400).json({ message: "Некорректный ID заявки" });
    }

    if (req.user.role !== "director") {
      return res.status(403).json({
        message: "Доступ запрещён",
        reason: "Удалять заявки может только пользователь с ролью director",
      });
    }

    const application = await Application.findByPk(applicationId);

    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (application.files && application.files.length > 0) {
      const uploadDir = path.join(
        __dirname,
        "../../uploads",
        String(applicationId),
      );

      try {
        for (const fileName of application.files) {
          const filePath = path.join(uploadDir, fileName);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
          }
        }

        // Если папка осталась пустой — удаляем её
        if (await fs.pathExists(uploadDir)) {
          const remainingFiles = await fs.readdir(uploadDir);
          if (remainingFiles.length === 0) {
            await fs.remove(uploadDir);
          }
        }
      } catch (fsErr) {
        console.error("Ошибка при удалении файлов заявки:", fsErr);
      }
    }

    // Удаляем запись заявки из базы данных
    await application.destroy();

    res.json({
      message: "Заявка успешно удалена",
      deletedId: applicationId,
    });
  } catch (err) {
    console.error("Ошибка при удалении заявки:", err);
    res.status(500).json({
      message: "Ошибка сервера при удалении заявки",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
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

// scripts/migrate.js
require("dotenv").config();
const sequelize = require("./db");
const { QueryTypes } = require("sequelize");

async function runMigration() {
  console.log("🚀 Запуск миграции...");

  try {
    // Подключаемся к БД
    await sequelize.authenticate();
    console.log("✅ Подключение к БД установлено");

    // Проверяем существование таблицы
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Applications'
      )`,
      { type: QueryTypes.SELECT },
    );

    if (!tableExists[0].exists) {
      console.log(
        "❌ Таблица Applications не существует. Сначала выполните sync",
      );
      process.exit(1);
    }

    // Получаем существующие колонки
    const existingColumns = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'Applications'`,
      { type: QueryTypes.SELECT },
    );

    const existingColumnNames = existingColumns.map((c) => c.column_name);
    console.log("📊 Существующие колонки:", existingColumnNames);

    // Определяем новые колонки
    const newColumns = [
      {
        name: "documentType",
        type: "VARCHAR(50)",
        comment: "Тип документа: акт выполненных работ или акт сверки",
      },
      {
        name: "inn",
        type: "VARCHAR(12)",
        comment: "ИНН организации (10 или 12 цифр)",
      },
      {
        name: "accountNumber",
        type: "VARCHAR(20)",
        comment: "Номер счёта",
      },
      {
        name: "periodFrom",
        type: "DATE",
        comment: "Начало периода",
      },
      {
        name: "periodTo",
        type: "DATE",
        comment: "Конец периода",
      },
      {
        name: "documentFormat",
        type: "VARCHAR(10)",
        comment: "Формат документа: PDF или ЭДО",
      },
      {
        name: "totalAmount",
        type: "DECIMAL(10,2)",
        comment: "Итоговая сумма",
      },
    ];

    // Добавляем новые колонки
    for (const column of newColumns) {
      if (!existingColumnNames.includes(column.name)) {
        console.log(`➕ Добавление колонки ${column.name}...`);

        await sequelize.query(`
          ALTER TABLE "Applications" 
          ADD COLUMN "${column.name}" ${column.type}
        `);

        // Добавляем комментарий
        if (column.comment) {
          await sequelize.query(`
            COMMENT ON COLUMN "Applications"."${column.name}" IS '${column.comment}'
          `);
        }

        console.log(`✅ Колонка ${column.name} добавлена`);
      } else {
        console.log(`⏭️ Колонка ${column.name} уже существует`);
      }
    }

    console.log("🎉 Миграция успешно завершена!");
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

runMigration();

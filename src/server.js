require("dotenv").config();
const app = require("./app");
const sequelize = require("./config/db");

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("SQLite подключена успешно");

    // Создаём таблицы (если их нет)
    await sequelize.sync({ force: false }); // force: true — удалит и пересоздаст таблицы!

    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Ошибка запуска:", err);
  }
}

start();

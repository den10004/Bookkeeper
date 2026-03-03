const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.POSTGRESQL_DBNAME || "myapp_dev",
  process.env.POSTGRESQL_USER || "postgres",
  process.env.POSTGRESQL_PASSWORD,
  {
    host: process.env.POSTGRESQL_HOST || "localhost",
    port: parseInt(process.env.POSTGRESQL_PORT || "5432", 10),
    dialect: "postgres",
    logging: false,
  },
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Подключение к PostgreSQL успешно установлено");

    await sequelize.sync({ alter: true });
    console.log("Модели синхронизированы с PostgreSQL");
  } catch (err) {
    console.error("Ошибка подключения или синхронизации:", err);
    process.exit(1);
  }
})();

module.exports = sequelize;

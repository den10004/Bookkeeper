const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "myapp_dev",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    dialect: "postgres",
    logging: false,
  },
);

sequelize
  .authenticate()
  .then(() => console.log("PostgreSQL подключён"))
  .catch((err) => {
    console.error("Ошибка подключения:", err);
    process.exit(1);
  });

module.exports = sequelize;

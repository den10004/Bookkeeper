const { Sequelize } = require("sequelize");

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.POSTGRESQL_HOST || "localhost",
  port: parseInt(process.env.POSTGRESQL_PORT || "5432", 10),
  database: process.env.POSTGRESQL_DBNAME || "myapp_dev",
  username: process.env.POSTGRESQL_USER || "postgres",
  password: process.env.POSTGRESQL_PASSWORD,

  logging: false,

  dialectOptions: {
    ssl: isProduction
      ? {
          require: true,
          rejectUnauthorized: false, // для облачных self-signed сертификатов
        }
      : false, // ← ключевой момент: локально SSL выключен
  },

  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

sequelize
  .authenticate()
  .then(() => console.log("PostgreSQL успешно подключена"))
  .catch((err) => {
    console.error("Ошибка подключения к PostgreSQL:", err.message || err);
    process.exit(1);
  });

module.exports = sequelize;

const { Sequelize } = require("sequelize");
const path = require("path");

const dialect = process.env.DB_DIALECT;

if (!dialect) {
  throw new Error(
    "Переменная DB_DIALECT не установлена! " +
      "Укажи DB_DIALECT=postgres для PostgreSQL или DB_DIALECT=sqlite для локального файла.",
  );
}

if (!["postgres", "sqlite"].includes(dialect)) {
  throw new Error(
    `Неподдерживаемый DB_DIALECT: ${dialect}. Допустимо только postgres или sqlite.`,
  );
}

const sequelize = new Sequelize({
  dialect,

  ...(dialect === "postgres" && {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "myapp_dev",
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,

    logging: false,
  }),
  /*
  ...(dialect === "sqlite" && {
    storage: path.join(__dirname, "../../database.sqlite"),
    logging: false,
  }),*/
});

sequelize
  .authenticate()
  .then(() => console.log(`Подключено к ${dialect.toUpperCase()}`))
  .catch((err) => {
    console.error("Ошибка подключения к БД:", err);
    process.exit(1);
  });

module.exports = sequelize;

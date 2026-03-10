const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

module.exports = {
  development: {
    username: process.env.POSTGRESQL_USER || "postgres",
    password: process.env.POSTGRESQL_PASSWORD || "postgres",
    database: process.env.POSTGRESQL_DBNAME || "mybookkeeper_dev",
    host: process.env.POSTGRESQL_HOST || "localhost",
    port: process.env.POSTGRESQL_PORT || 5432,
    dialect: "postgres",
    logging: false,
  },
  production: {
    username: process.env.POSTGRESQL_USER,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DBNAME,
    host: process.env.POSTGRESQL_HOST,
    port: process.env.POSTGRESQL_PORT || 5432,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};

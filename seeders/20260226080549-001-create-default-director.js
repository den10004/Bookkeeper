// seeders/2026XXXXXXXXXX-001-init-director.js
"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT 1 FROM "Users" 
       WHERE username = 'director' OR email = 'director@example.com' 
       LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    if (existing) {
      console.log(
        "→ Пользователь director уже существует → пропускаем создание",
      );
      return;
    }

    const plainPassword = process.env.PASSWORD_DIRECTOR;

    if (!plainPassword) {
      console.error("!!! ERROR: process.env.PASSWORD_DIRECTOR не задан !!!");
      console.error("Установите переменную окружения перед запуском seed");
      throw new Error(
        "PASSWORD_DIRECTOR is required for initial director seed",
      );
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    await queryInterface.bulkInsert("Users", [
      {
        username: "director",
        email: "director@example.com",
        password: hashedPassword,
        role: "director",
        refreshTokenHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    console.log("Создан начальный пользователь director");
    console.log(`  • username: director`);
    console.log(`  • email:    director@example.com`);
    console.log(`  • role:     director`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Users", {
      username: "director",
    });
  },
};

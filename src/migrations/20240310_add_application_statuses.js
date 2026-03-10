// migrations/20240310-add-application-status.js

"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Создаем ENUM тип для статусов
      await queryInterface.sequelize.query(
        `
        CREATE TYPE "enum_Applications_status" AS ENUM (
          'new', 
          'updated', 
          'accepted', 
          'in_progress', 
          'completed', 
          'rejected'
        );
      `,
        { transaction },
      );

      // Добавляем поле status
      await queryInterface.addColumn(
        "Applications",
        "status",
        {
          type: Sequelize.DataTypes.ENUM(
            "new",
            "updated",
            "accepted",
            "in_progress",
            "completed",
            "rejected",
          ),
          defaultValue: "new",
          allowNull: false,
        },
        { transaction },
      );

      // Добавляем поле statusComment (опционально)
      await queryInterface.addColumn(
        "Applications",
        "statusComment",
        {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        { transaction },
      );

      // Устанавливаем статус 'new' для всех существующих записей
      await queryInterface.sequelize.query(
        `UPDATE "Applications" SET "status" = 'new' WHERE "status" IS NULL;`,
        { transaction },
      );
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Удаляем поля
      await queryInterface.removeColumn("Applications", "status", {
        transaction,
      });
      await queryInterface.removeColumn("Applications", "statusComment", {
        transaction,
      });

      // Удаляем ENUM тип
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Applications_status";',
        { transaction },
      );
    });
  },
};

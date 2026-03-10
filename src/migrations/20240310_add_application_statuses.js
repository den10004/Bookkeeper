"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
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

      await queryInterface.addColumn(
        "Applications",
        "status",
        {
          type: Sequelize.DataTypes.ENUM("new", "updated"),
          defaultValue: "new",
          allowNull: false,
        },
        { transaction },
      );
      await queryInterface.addColumn(
        "Applications",
        "statusComment",
        {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE "Applications" SET "status" = 'new' WHERE "status" IS NULL;`,
        { transaction },
      );
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("Applications", "status", {
        transaction,
      });
      await queryInterface.removeColumn("Applications", "statusComment", {
        transaction,
      });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Applications_status";',
        { transaction },
      );
    });
  },
};

// src/models/application.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./user");

const Application = sequelize.define(
  "Application",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    files: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment:
        "Массив объектов: [{ stored: 'uuid.ext', original: 'имя файла' }]",
    },
    downloadLinks: {
      type: DataTypes.VIRTUAL,
      get() {
        const files = this.getDataValue("files") || [];
        return files.map((file) => ({
          original: file.original,
          url: `/protected/download/${this.id}/${encodeURIComponent(file.stored)}`,
        }));
      },
    },

    // Правильное определение двух отдельных полей
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User, // или "Users" — зависит от того, как таблица называется
        key: "id",
      },
    },

    assignedAccountantId: {
      type: DataTypes.INTEGER,
      allowNull: false, // или true, если бухгалтер может быть не назначен сразу
      references: {
        model: User,
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  },
  {
    timestamps: true,
  },
);

User.hasMany(Application, {
  foreignKey: "userId",
  as: "CreatedApplications",
});

Application.belongsTo(User, {
  foreignKey: "userId",
  as: "Creator",
});

User.hasMany(Application, {
  foreignKey: "assignedAccountantId",
  as: "AssignedApplications",
});

Application.belongsTo(User, {
  foreignKey: "assignedAccountantId",
  as: "AssignedAccountant",
});

module.exports = Application;

const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./user");

const Application = sequelize.define(
  "Application",
  {
    requestType: {
      type: DataTypes.ENUM("new_client", "existing_client", "document_request"),
      allowNull: false,
      defaultValue: "new_client",
    },
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
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    files: {
      type: DataTypes.JSON,
      defaultValue: [],
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

    // ─────── ИСПРАВЛЕННЫЙ БЛОК userId ───────
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // ← было false
      references: {
        model: User,
        key: "id",
      },
      onDelete: "SET NULL", // ← главное исправление
      onUpdate: "CASCADE",
    },

    assignedAccountantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    documentType: { type: DataTypes.STRING, allowNull: true },
    inn: { type: DataTypes.STRING(12), allowNull: true },
    accountNumber: { type: DataTypes.STRING(20), allowNull: true },
    periodFrom: { type: DataTypes.DATEONLY, allowNull: true },
    periodTo: { type: DataTypes.DATEONLY, allowNull: true },
    documentFormat: { type: DataTypes.STRING, allowNull: true },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  },
  { timestamps: true },
);

// ─────── ИСПРАВЛЕННЫЕ АССОЦИАЦИИ ───────
User.hasMany(Application, {
  foreignKey: "userId",
  as: "CreatedApplications",
  onDelete: "SET NULL",
});

Application.belongsTo(User, {
  foreignKey: "userId",
  as: "Creator",
  onDelete: "SET NULL",
});

User.hasMany(Application, {
  foreignKey: "assignedAccountantId",
  as: "AssignedApplications",
  onDelete: "SET NULL",
});

Application.belongsTo(User, {
  foreignKey: "assignedAccountantId",
  as: "AssignedAccountant",
  onDelete: "SET NULL",
});

module.exports = Application;

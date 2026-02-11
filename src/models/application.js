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
      type: DataTypes.JSON, // массив путей к файлам, напр. ["file1.pdf", "file2.jpg"]
      defaultValue: [],
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      assignedAccountantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: User, key: "id" },
      },
    },
  },
  {
    timestamps: true,
  },
);

User.hasMany(Application, { foreignKey: "userId", as: "CreatedApplications" });
Application.belongsTo(User, { foreignKey: "userId", as: "Creator" });

User.hasMany(Application, {
  foreignKey: "assignedAccountantId",
  as: "AssignedApplications",
});
Application.belongsTo(User, {
  foreignKey: "assignedAccountantId",
  as: "AssignedAccountant",
});

module.exports = Application;

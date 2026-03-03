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

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
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

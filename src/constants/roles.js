// constants/roles.js
const ROLES = {
  DIRECTOR: "director",
  ACCOUNTANT: "accountant",
  MANAGER: "manager",
};

const ROLE_NAMES = {
  [ROLES.DIRECTOR]: "Директор",
  [ROLES.ACCOUNTANT]: "Бухгалтер",
  [ROLES.MANAGER]: "Менеджер",
};

const ROLE_HIERARCHY = {
  [ROLES.DIRECTOR]: 3,
  [ROLES.ACCOUNTANT]: 2,
  [ROLES.MANAGER]: 1,
};

module.exports = {
  ROLES,
  ROLE_NAMES,
  ROLE_HIERARCHY,
};

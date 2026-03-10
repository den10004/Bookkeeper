// constants/roles.js
const ROLES = {
  DIRECTOR: "director",
  ACCOUNTANT: "accountant",
  MANAGER: "manager",
  ROP: "rop",
};

const ROLE_NAMES = {
  [ROLES.DIRECTOR]: "Директор",
  [ROLES.ACCOUNTANT]: "Бухгалтер",
  [ROLES.MANAGER]: "Менеджер",
  [ROLES.ROP]: "роп",
};

const ROLE_HIERARCHY = {
  [ROLES.ROP]: 4,
  [ROLES.DIRECTOR]: 3,
  [ROLES.ACCOUNTANT]: 2,
  [ROLES.MANAGER]: 1,
};

const APPLICATION_STATUSES = {
  NEW: "new",
  UPDATED: "updated",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REJECTED: "rejected",
};

module.exports = {
  ROLES,
  ROLE_NAMES,
  ROLE_HIERARCHY,
  APPLICATION_STATUSES,
};

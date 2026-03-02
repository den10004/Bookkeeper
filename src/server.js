require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use((socket, next) => {
  const authHeader = socket.handshake.headers.authorization;

  if (!authHeader) {
    return next(new Error("Authentication error: token required"));
  }

  let token = authHeader;
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return next(new Error("Authentication error: token required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log(
      `Socket authenticated for user: ${decoded.id} (${decoded.role})`,
    );
    next();
  } catch (err) {
    console.log("Socket auth failed:", err.message);
    return next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;

  if (!user || !user.id) {
    socket.disconnect(true);
    return;
  }

  const userId = user.id;
  const role = user.role;

  socket.join(`user:${userId}`);

  if (role === "director") {
    socket.join("role:director");
  } else if (role === "accountant") {
    socket.join("role:accountant");
  }

  console.log(
    `User ${userId} (${role}) joined rooms: user:${userId}, role:${role || "none"}`,
  );

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`Server + Socket.IO запущен на порту ${PORT}`);
});

module.exports.io = io;

// sseClients.js
const clients = new Set();

function addClient(res) {
  clients.add(res);
  // Опционально: можно отправить heartbeat каждые ~30 сек
  const heartbeat = setInterval(() => {
    if (clients.has(res) && !res.writableEnded) {
      res.write(": heartbeat\n\n");
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  res.on("close", () => {
    clients.delete(res);
    clearInterval(heartbeat);
  });
}

function broadcastNewApplication(application) {
  const message = `data: ${JSON.stringify({ type: "new", application })}\n\n`;

  for (const client of clients) {
    if (!client.writableEnded) {
      client.write(message);
    }
  }
}

module.exports = { addClient, broadcastNewApplication };

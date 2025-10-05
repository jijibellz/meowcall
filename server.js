const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const PORT = 3000;

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {
  console.log("🐾 New user connected:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);
    socket.join(roomId);

    console.log(`User ${socket.id} joined ${roomId}`);

    // Tell the new user who’s already there
    const others = rooms[roomId].filter((id) => id !== socket.id);
    socket.emit("all-users", others);

    // Tell others that a new user joined
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("signal", (data) => {
    io.to(data.to).emit("signal", {
      from: socket.id,
      signal: data.signal,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

http.listen(PORT, () => console.log(`🐱 Server running at http://localhost:${PORT}`));

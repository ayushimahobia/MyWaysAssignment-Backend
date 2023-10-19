const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const app = express();
const http = require("http");
const socketIo = require("socket.io");

dotenv.config();

app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error(err));

// MongoDB Models
const User = mongoose.model("User", {
  username: String,
  email: String,
  password: String,
  roomId: String,
});

const ChatRoom = mongoose.model("ChatRoom", {
  roomId: {
    type: String,
    required: true,
  },
  creator: {
    type: String,
    required: true,
  },
  members: [
    {
      type: String,
    },
  ],
  messages: [{ user: String, message: String, timestamp: Date }],
});

const Task = mongoose.model("Task", {
  title: String,
  description: String,
  status: String,
});

// Authentication
const JWT_SECRET = process.env.JWT_SECRET;

app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET);
    res.json({ token, username: user.username, email: user.email });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Chat Room Routes
app.post("/chat/create-room", async (req, res) => {
  const { creator } = req.body;
  const generatedRoomId = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  try {
    const chatRoom = new ChatRoom({ roomId: generatedRoomId, creator });
    await chatRoom.save();
    console.log(generatedRoomId);
    res.status(201).json({
      message: "Chat room created successfully",
      roomId: generatedRoomId,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create the chat room" });
  }
});

//join room
app.post("/chat/join-room", async (req, res) => {
  const { roomId, userEmail } = req.body;

  try {
    const chatRoom = await ChatRoom.findOne({ roomId });

    if (!chatRoom) {
      return res.status(404).json({ error: "Chat room not found" });
    }

    if (chatRoom.members.includes(userEmail)) {
      return res
        .status(200)
        .json({ message: "User is already a member of this chat room" });
    }

    chatRoom.members.push(userEmail);

    await chatRoom.save();

    const user = await User.findOne({ email: userEmail });
    user.roomId = roomId;
    await user.save();

    res.status(200).json({ message: "Joined chat room successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to join the chat room" });
  }
});

io.on("connection", (socket) => {
  socket.on("joinRoom", (roomId, user) => {
    socket.join(roomId);
    socket.emit("message", "Welcome to the chat room!");

    socket.to(roomId).broadcast.emit("message", `${user} has joined the chat`);
  });

  socket.on("chatMessage", async (roomId, user, message) => {
    const room = await ChatRoom.findById(roomId);
    room.messages.push({ user, message, timestamp: new Date() });
    await room.save();

    io.to(roomId).emit("message", `${user}: ${message}`);
  });
});

// Task Routes
app.post("/task/create-task", (req, res) => {
  // Implement task creation logic
});

app.put("/task/update-task/:taskId", (req, res) => {
  // Implement task update logic
});

app.delete("/task/delete-task/:taskId", (req, res) => {
  // Implement task deletion logic
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

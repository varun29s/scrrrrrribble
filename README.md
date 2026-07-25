# 🎨 Scrrrrrribble

A real-time multiplayer drawing and guessing game inspired by Skribbl.io. Players create or join game rooms, draw randomly selected words, chat with others, and compete on a live leaderboard.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🚀 Features

- 🎨 Real-time collaborative drawing
- 👥 Multiplayer game rooms
- 💬 Live chat system
- ✏️ Word selection for the drawer
- ⏱️ Countdown timer
- 🏆 Automatic scoring & leaderboard
- 🎭 Avatar selection
- 🔗 Room invite codes
- 📱 Responsive UI
- ⚡ Real-time synchronization using Socket.IO

---

## 📸 Screenshots

> Add screenshots here after deployment.

| Home | Game |
|------|------|
|(<img width="1920" height="927" alt="image" src="https://github.com/user-attachments/assets/cae2d2c4-d52a-4cb5-801f-31e5552344b8" />
) | ![Game](screenshots/game.png) |

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- Socket.IO

---

## 📂 Project Structure

```text
scrrrrrribble/
│
├── css/
├── js/
├── assets/
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/varun29s/scrrrrrribble.git
cd scrrrrrribble
```

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

or

```bash
node server.js
```

---

## 🌐 Local URL

```
http://localhost:3000
```

---

## 📡 Socket.IO Events

### Client → Server

- create-room
- join-room
- start-game
- draw
- guess
- clear-canvas
- disconnect

### Server → Client

- room-created
- room-joined
- player-update
- game-start
- drawing
- leaderboard-update
- game-over

---

## 🎮 How to Play

1. Enter your username.
2. Create a room or join using an invite code.
3. Wait for players to join.
4. The drawer chooses one of the given words.
5. Draw the selected word.
6. Other players guess using the chat.
7. Earn points for correct guesses.
8. Highest score wins.

---

## 🚀 Deployment

### Backend

Deploy on:

- Render
- Railway
- Fly.io

Start Command

```bash
node server.js
```

### Frontend

Deploy on:

- Vercel
- Netlify
- GitHub Pages

---

## 📦 Environment

```
PORT=3000
NODE_ENV=production
```

---

## 👨‍💻 Author

**Varun BS**

- GitHub: https://github.com/varun29s
- LinkedIn: https://linkedin.com/in/varun-bs

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub.

---

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ by **Varun BS**
mindriiiiiiing
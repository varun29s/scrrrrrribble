const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const words = require("./words");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, "public")));

// Redirect any other requests to index.html (useful for room routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Game lobbies in-memory database
const lobbies = new Map();

// Helper: Levenshtein distance for close guesses
function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Helper: Generate unique lobby ID
function generateLobbyId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Helper: Select 3 unique random words
function getRandomWords(count = 3) {
  const shuffled = [...words].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Generate word hint (e.g. "apple" -> "_ _ _ _ _", "ice cream" -> "_ _ _   _ _ _ _ _")
function getWordHint(word, revealedIndices = []) {
  let hint = "";
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    if (char === " " || char === "-") {
      hint += char;
    } else if (revealedIndices.includes(i)) {
      hint += char;
    } else {
      hint += "_";
    }
  }
  return hint;
}

// State transition and game loop methods
function broadcastLobbyUpdate(lobby) {
  const playersList = Array.from(lobby.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    roundScore: p.roundScore,
    guessed: p.guessed,
    isDrawing: lobby.currentDrawer === p.id,
    isHost: lobby.creatorId === p.id
  }));

  // Send tailored state update to each socket to prevent cheating (hiding the correct word)
  lobby.players.forEach((player) => {
    const socket = io.sockets.sockets.get(player.id);
    if (!socket) return;

    const baseState = {
      id: lobby.id,
      isPrivate: lobby.isPrivate,
      state: lobby.state,
      players: playersList,
      settings: lobby.settings,
      currentRound: lobby.currentRound,
      currentDrawer: lobby.currentDrawer,
      timer: lobby.timer,
    };

    if (lobby.state === "WORD_CHOICE") {
      // Only the drawer knows the word choices
      if (player.id === lobby.currentDrawer) {
        baseState.wordChoices = lobby.wordChoices;
      }
    } else if (lobby.state === "DRAWING") {
      if (player.id === lobby.currentDrawer) {
        baseState.currentWord = lobby.currentWord;
      } else {
        baseState.hints = getWordHint(lobby.currentWord, lobby.revealedIndices);
      }
    } else if (lobby.state === "INTERMISSION" || lobby.state === "GAME_OVER") {
      // In intermission or game over, reveal the word to everyone
      baseState.currentWord = lobby.currentWord;
    }

    socket.emit("lobby-update", baseState);
  });
}

function clearLobbyTimer(lobby) {
  if (lobby.intervalId) {
    clearInterval(lobby.intervalId);
    lobby.intervalId = null;
  }
}

function startTurn(lobby) {
  clearLobbyTimer(lobby);

  // If no players, discard lobby
  if (lobby.players.size === 0) {
    lobbies.delete(lobby.id);
    return;
  }

  // Check if we need to advance round
  if (lobby.drawerQueue.length === 0) {
    if (lobby.currentRound < lobby.settings.rounds) {
      lobby.currentRound++;
      lobby.drawerQueue = Array.from(lobby.players.keys());
      // Broadcast system announcement
      io.to(lobby.id).emit("chat-announcement", {
        type: "round-start",
        message: `Round ${lobby.currentRound} of ${lobby.settings.rounds} is starting!`
      });
    } else {
      endGame(lobby);
      return;
    }
  }

  // Pick next drawer
  const nextDrawer = lobby.drawerQueue.shift();
  const drawerPlayer = lobby.players.get(nextDrawer);

  // If player left in the meantime, retry
  if (!drawerPlayer) {
    startTurn(lobby);
    return;
  }

  lobby.currentDrawer = nextDrawer;
  lobby.state = "WORD_CHOICE";
  lobby.wordChoices = getRandomWords(3);
  lobby.currentWord = "";
  lobby.revealedIndices = [];
  lobby.canvasHistory = [];

  // Reset guessing status for all players
  lobby.players.forEach(p => {
    p.guessed = false;
    p.roundScore = 0;
  });

  io.to(lobby.id).emit("clear-canvas");

  lobby.timer = 15; // 15 seconds to choose a word
  broadcastLobbyUpdate(lobby);

  io.to(lobby.id).emit("chat-announcement", {
    type: "info",
    message: `${drawerPlayer.name} is choosing a word!`
  });

  lobby.intervalId = setInterval(() => {
    lobby.timer--;
    if (lobby.timer <= 0) {
      // Automatically choose a random word from the selection
      const autoWord = lobby.wordChoices[Math.floor(Math.random() * lobby.wordChoices.length)];
      startDrawing(lobby, autoWord);
    } else {
      io.to(lobby.id).emit("timer-update", { timer: lobby.timer });
    }
  }, 1000);
}

function startDrawing(lobby, chosenWord) {
  clearLobbyTimer(lobby);
  
  const drawerPlayer = lobby.players.get(lobby.currentDrawer);
  if (!drawerPlayer) {
    startTurn(lobby);
    return;
  }

  lobby.state = "DRAWING";
  lobby.currentWord = chosenWord;
  lobby.timer = lobby.settings.drawTime;
  lobby.revealedIndices = [];

  broadcastLobbyUpdate(lobby);
  io.to(lobby.id).emit("clear-canvas");
  
  io.to(lobby.id).emit("chat-announcement", {
    type: "info",
    message: `${drawerPlayer.name} is drawing now!`
  });

  // Calculate when to reveal hints
  // Let's plan reveals at 50% and 25% of time left, depending on word length
  const wordLen = chosenWord.replace(/[\s-]/g, "").length;
  const revealTimes = [];
  if (wordLen > 3) {
    revealTimes.push(Math.floor(lobby.settings.drawTime * 0.6));
  }
  if (wordLen > 6) {
    revealTimes.push(Math.floor(lobby.settings.drawTime * 0.3));
  }

  lobby.intervalId = setInterval(() => {
    lobby.timer--;
    
    // Hint reveal logic
    if (revealTimes.includes(lobby.timer)) {
      revealRandomLetter(lobby);
    }

    if (lobby.timer <= 0) {
      endTurn(lobby);
    } else {
      io.to(lobby.id).emit("timer-update", { timer: lobby.timer });
    }
  }, 1000);
}

function revealRandomLetter(lobby) {
  const word = lobby.currentWord;
  const unrevealed = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " " && word[i] !== "-" && !lobby.revealedIndices.includes(i)) {
      unrevealed.push(i);
    }
  }

  if (unrevealed.length > 0) {
    const randIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    lobby.revealedIndices.push(randIdx);
    // Broadcast updated hint to guessers
    const hints = getWordHint(word, lobby.revealedIndices);
    
    // Broadcast hints to guessers only
    lobby.players.forEach(p => {
      if (p.id !== lobby.currentDrawer) {
        const socket = io.sockets.sockets.get(p.id);
        if (socket) {
          socket.emit("hints-update", { hints });
        }
      }
    });
  }
}

function endTurn(lobby) {
  clearLobbyTimer(lobby);

  const drawerPlayer = lobby.players.get(lobby.currentDrawer);
  
  // Calculate scores for this round
  let correctGuessersCount = 0;
  lobby.players.forEach(p => {
    if (p.id !== lobby.currentDrawer && p.guessed) {
      correctGuessersCount++;
    }
  });

  // Calculate drawer score
  let drawerRoundScore = 0;
  if (correctGuessersCount > 0 && drawerPlayer) {
    // Max 250 points, proportional to number of correct guessers
    const totalGuessers = lobby.players.size - 1;
    drawerRoundScore = Math.floor(250 * (correctGuessersCount / Math.max(1, totalGuessers)));
    drawerPlayer.roundScore = drawerRoundScore;
    drawerPlayer.score += drawerRoundScore;
  }

  lobby.state = "INTERMISSION";
  lobby.timer = 10; // 10 seconds to show scoreboard

  broadcastLobbyUpdate(lobby);

  io.to(lobby.id).emit("chat-announcement", {
    type: "reveal",
    message: `The word was: ${lobby.currentWord}`
  });

  lobby.intervalId = setInterval(() => {
    lobby.timer--;
    if (lobby.timer <= 0) {
      startTurn(lobby);
    } else {
      io.to(lobby.id).emit("timer-update", { timer: lobby.timer });
    }
  }, 1000);
}

function endGame(lobby) {
  clearLobbyTimer(lobby);
  lobby.state = "GAME_OVER";
  lobby.timer = 15; // 15 seconds to display podium

  // Sort players by score
  const sortedPlayers = Array.from(lobby.players.values()).sort((a, b) => b.score - a.score);

  broadcastLobbyUpdate(lobby);

  io.to(lobby.id).emit("chat-announcement", {
    type: "game-over",
    message: `Game Over! Winner: ${sortedPlayers[0] ? sortedPlayers[0].name : "No one"}`
  });

  lobby.intervalId = setInterval(() => {
    lobby.timer--;
    if (lobby.timer <= 0) {
      // Restart lobby
      lobby.state = "LOBBY";
      lobby.currentRound = 0;
      lobby.currentDrawer = "";
      lobby.currentWord = "";
      lobby.drawerQueue = [];
      lobby.canvasHistory = [];
      lobby.players.forEach(p => {
        p.score = 0;
        p.roundScore = 0;
        p.guessed = false;
      });
      broadcastLobbyUpdate(lobby);
      io.to(lobby.id).emit("clear-canvas");
    } else {
      io.to(lobby.id).emit("timer-update", { timer: lobby.timer });
    }
  }, 1000);
}

// Socket Management
io.on("connection", (socket) => {
  let userLobbyId = null;

  socket.on("join-lobby", ({ name, avatar, lobbyCode }) => {
    name = (name || "Player").trim().substring(0, 16);
    let lobby = null;

    if (lobbyCode && lobbyCode !== "__NEW_PRIVATE__") {
      const code = lobbyCode.toUpperCase();
      lobby = lobbies.get(code);
      if (!lobby) {
        socket.emit("error-message", "Lobby not found!");
        return;
      }
      if (lobby.players.size >= 12) {
        socket.emit("error-message", "Lobby is full!");
        return;
      }
    } else if (lobbyCode === "__NEW_PRIVATE__") {
      // Create new private lobby
      const id = generateLobbyId();
      lobby = {
        id,
        isPrivate: true,
        creatorId: socket.id,
        players: new Map(),
        settings: { rounds: 3, drawTime: 80, language: "english" },
        state: "LOBBY",
        currentRound: 0,
        currentDrawer: "",
        drawerQueue: [],
        wordChoices: [],
        currentWord: "",
        revealedIndices: [],
        timer: 0,
        canvasHistory: [],
        intervalId: null
      };
      lobbies.set(id, lobby);
    } else {
      // Find an available public lobby
      for (const [id, l] of lobbies.entries()) {
        if (!l.isPrivate && l.state === "LOBBY" && l.players.size < 8) {
          lobby = l;
          break;
        }
      }

      // Create new public lobby if none found
      if (!lobby) {
        const id = generateLobbyId();
        lobby = {
          id,
          isPrivate: false,
          creatorId: socket.id,
          players: new Map(),
          settings: { rounds: 3, drawTime: 80, language: "english" },
          state: "LOBBY",
          currentRound: 0,
          currentDrawer: "",
          drawerQueue: [],
          wordChoices: [],
          currentWord: "",
          revealedIndices: [],
          timer: 0,
          canvasHistory: [],
          intervalId: null
        };
        lobbies.set(id, lobby);
      }
    }

    userLobbyId = lobby.id;
    socket.join(lobby.id);

    // Create player entry
    const newPlayer = {
      id: socket.id,
      name,
      avatar,
      score: 0,
      roundScore: 0,
      guessed: false,
      guessedTime: 0
    };

    lobby.players.set(socket.id, newPlayer);

    // If game in progress, add player to drawing queue if it doesn't break balance
    if (lobby.state !== "LOBBY" && lobby.state !== "GAME_OVER") {
      // Player joins mid-game. Let's make them part of the next rounds
      // We won't insert them in the current round queue to avoid disruption, or add them to the end
      lobby.drawerQueue.push(socket.id);
    }

    // Set initial creator if creator disconnected
    if (!lobby.creatorId || !lobby.players.has(lobby.creatorId)) {
      lobby.creatorId = socket.id;
    }

    // Broadcast update
    broadcastLobbyUpdate(lobby);

    // Send history to the new player
    socket.emit("canvas-history", lobby.canvasHistory);

    // Announce player join
    io.to(lobby.id).emit("chat-announcement", {
      type: "join",
      message: `${name} has joined the room!`
    });
  });

  socket.on("select-word", ({ word }) => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.state !== "WORD_CHOICE" || lobby.currentDrawer !== socket.id) return;

    if (lobby.wordChoices.includes(word)) {
      startDrawing(lobby, word);
    }
  });

  socket.on("chat-message", (messageStr) => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby) return;

    const sender = lobby.players.get(socket.id);
    if (!sender) return;

    const trimmedMsg = messageStr.trim().substring(0, 100);
    if (!trimmedMsg) return;

    const lowerMsg = trimmedMsg.toLowerCase();
    const secretWord = lobby.currentWord.toLowerCase().trim();

    // Check if drawing player tries to send the word
    if (lobby.currentDrawer === socket.id && lobby.state === "DRAWING") {
      if (lowerMsg.includes(secretWord) && secretWord.length > 0) {
        socket.emit("chat-announcement", {
          type: "warning",
          message: "You cannot say the secret word!"
        });
        return;
      }
    }

    // Guess validation
    if (lobby.state === "DRAWING" && lobby.currentDrawer !== socket.id) {
      if (sender.guessed) {
        // Player already guessed, their messages only show to other guessers
        lobby.players.forEach(p => {
          if (p.guessed || p.id === lobby.currentDrawer) {
            const destSocket = io.sockets.sockets.get(p.id);
            if (destSocket) {
              destSocket.emit("chat-message", {
                senderId: sender.id,
                name: sender.name,
                message: trimmedMsg,
                style: "guesser-chat"
              });
            }
          }
        });
        return;
      }

      if (lowerMsg === secretWord) {
        // Correct Guess!
        sender.guessed = true;
        sender.guessedTime = Date.now();

        // Calculate points: base score + speed bonus
        const guessCount = Array.from(lobby.players.values()).filter(p => p.guessed).length;
        const totalPossibleGuessers = lobby.players.size - 1;
        
        // Speed score (max 500, min 100) based on ratio of time left
        const speedRatio = lobby.timer / lobby.settings.drawTime;
        const speedScore = Math.max(100, Math.floor(400 * speedRatio));
        
        // Guesser bonus: first guesser gets +100, second gets +50, etc.
        const orderBonus = guessCount === 1 ? 100 : guessCount === 2 ? 50 : 25;
        const totalRoundScore = speedScore + orderBonus;

        sender.roundScore = totalRoundScore;
        sender.score += totalRoundScore;

        socket.emit("correct-guess-event", { score: totalRoundScore });

        io.to(lobby.id).emit("chat-announcement", {
          type: "success",
          message: `${sender.name} guessed the word!`
        });

        // Trigger visual highlight update
        broadcastLobbyUpdate(lobby);

        // Check if all guessers are correct
        const guessersLeft = Array.from(lobby.players.values()).some(p => p.id !== lobby.currentDrawer && !p.guessed);
        if (!guessersLeft) {
          endTurn(lobby);
        }
        return;
      }

      if (getLevenshteinDistance(lowerMsg, secretWord) === 1 && secretWord.length > 2) {
        // Close guess warning (sent privately)
        socket.emit("chat-announcement", {
          type: "close",
          message: `"${trimmedMsg}" is close!`
        });
      }
    }

    // During DRAWING: wrong guesses are broadcast as a 'wrong-guess' event so all
    // players see every attempt live. Outside drawing, use normal chat-message.
    if (lobby.state === "DRAWING" && lobby.currentDrawer !== socket.id && !sender.guessed) {
      // Broadcast the wrong guess to everyone in the lobby
      io.to(lobby.id).emit("wrong-guess", {
        senderId: sender.id,
        name: sender.name,
        guess: trimmedMsg
      });
    } else {
      // Regular chat (lobby / intermission / post-game / drawer talking)
      io.to(lobby.id).emit("chat-message", {
        senderId: sender.id,
        name: sender.name,
        message: trimmedMsg,
        style: sender.guessed ? "guessed" : ""
      });
    }
  });

  // Canvas Actions
  socket.on("drawing-event", (data) => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.state !== "DRAWING" || lobby.currentDrawer !== socket.id) return;

    lobby.canvasHistory.push({ type: "draw", data });
    socket.to(lobby.id).emit("drawing-event", data);
  });

  socket.on("clear-canvas", () => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.state !== "DRAWING" || lobby.currentDrawer !== socket.id) return;

    lobby.canvasHistory = [];
    io.to(lobby.id).emit("clear-canvas");
  });

  socket.on("undo-canvas", () => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.state !== "DRAWING" || lobby.currentDrawer !== socket.id) return;

    // Pop last draw stroke
    if (lobby.canvasHistory.length > 0) {
      // Find the last stroke (group of lines between draw-start and draw-end or similar, depending on canvas representation)
      // Since we just emit point structures, let's look at how client groups strokes.
      // If we push raw events, we can just push an "undo" command or re-transmit canvas history minus the last stroke.
      // Let's filter lobby.canvasHistory. Each stroke starts with a type "start" or is just items.
      // If we keep it simple: the history contains strokes, and we pop the last stroke.
      // We will handle strokes client side and transmit strokes. A stroke is an array of points.
      // In canvasHistory, we store: { type: 'stroke', points, color, size, tool }
      // This makes undo trivial: lobby.canvasHistory.pop().
      lobby.canvasHistory.pop();
      io.to(lobby.id).emit("canvas-history", lobby.canvasHistory);
    }
  });

  socket.on("fill-canvas", (data) => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.state !== "DRAWING" || lobby.currentDrawer !== socket.id) return;

    lobby.canvasHistory.push({ type: "fill", data });
    socket.to(lobby.id).emit("fill-canvas", data);
  });

  // Settings modification
  socket.on("change-settings", (settings) => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.creatorId !== socket.id || lobby.state !== "LOBBY") return;

    lobby.settings.rounds = Math.max(1, Math.min(10, parseInt(settings.rounds) || 3));
    lobby.settings.drawTime = Math.max(30, Math.min(180, parseInt(settings.drawTime) || 80));
    
    broadcastLobbyUpdate(lobby);
  });

  socket.on("start-game", () => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby || lobby.creatorId !== socket.id || lobby.state !== "LOBBY") return;

    if (lobby.players.size < 2) {
      socket.emit("error-message", "At least 2 players are needed to start the game!");
      return;
    }

    lobby.currentRound = 0;
    lobby.drawerQueue = Array.from(lobby.players.keys());
    startTurn(lobby);
  });

  socket.on("disconnect", () => {
    if (!userLobbyId) return;
    const lobby = lobbies.get(userLobbyId);
    if (!lobby) return;

    const player = lobby.players.get(socket.id);
    if (!player) return;

    lobby.players.delete(socket.id);
    socket.leave(lobby.id);

    io.to(lobby.id).emit("chat-announcement", {
      type: "leave",
      message: `${player.name} has left the room.`
    });

    // Remove from queue
    lobby.drawerQueue = lobby.drawerQueue.filter(id => id !== socket.id);

    if (lobby.players.size === 0) {
      clearLobbyTimer(lobby);
      lobbies.delete(lobby.id);
      return;
    }

    // Reassign host if creator disconnected
    if (lobby.creatorId === socket.id) {
      lobby.creatorId = lobby.players.keys().next().value;
      const newCreator = lobby.players.get(lobby.creatorId);
      if (newCreator) {
        io.to(lobby.id).emit("chat-announcement", {
          type: "info",
          message: `${newCreator.name} is the new host!`
        });
      }
    }

    // Handle disconnected drawer during turn
    if (lobby.currentDrawer === socket.id) {
      io.to(lobby.id).emit("chat-announcement", {
        type: "warning",
        message: "The drawing player disconnected! Starting next turn..."
      });
      startTurn(lobby);
      return;
    }

    // Reset game to lobby if too few players left mid-game
    if (lobby.players.size < 2 && lobby.state !== "LOBBY") {
      clearLobbyTimer(lobby);
      lobby.state = "LOBBY";
      lobby.currentRound = 0;
      lobby.currentDrawer = "";
      lobby.currentWord = "";
      lobby.drawerQueue = [];
      lobby.canvasHistory = [];
      lobby.players.forEach(p => {
        p.score = 0;
        p.roundScore = 0;
        p.guessed = false;
      });
      io.to(lobby.id).emit("chat-announcement", {
        type: "warning",
        message: "Not enough players! Resetting to lobby."
      });
      io.to(lobby.id).emit("clear-canvas");
      broadcastLobbyUpdate(lobby);
      return;
    }

    // If a guesser left, check if all active guessers have guessed
    if (lobby.state === "DRAWING") {
      const guessersLeft = Array.from(lobby.players.values()).some(p => p.id !== lobby.currentDrawer && !p.guessed);
      if (!guessersLeft) {
        endTurn(lobby);
        return;
      }
    }

    broadcastLobbyUpdate(lobby);
  });
});

// Start Express + HTTP Socket.io server
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Skribbl Clone Server listening on port ${PORT}`);
  });
}

// Export functions and server instance for test suites
module.exports = {
  app,
  server,
  getLevenshteinDistance,
  generateLobbyId,
  getRandomWords,
  getWordHint
};

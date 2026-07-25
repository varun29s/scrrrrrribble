// Socket client configuration
const socket = io();

// Instantiate the drawing Whiteboard
const whiteboard = new Whiteboard("drawing-canvas");

// Avatar Generator Customization Assets
const avatarColors = [
  "#f87171", // light red
  "#fb923c", // orange
  "#fbbf24", // yellow
  "#34d399", // emerald green
  "#22d3ee", // cyan
  "#60a5fa", // electric blue
  "#818cf8", // indigo
  "#c084fc", // purple
  "#f472b6", // pink
  "#94a3b8"  // slate
];

const avatarEyes = [
  // Normal dots
  `<circle cx="36" cy="44" r="4.5" fill="#0f172a" />
   <circle cx="64" cy="44" r="4.5" fill="#0f172a" />`,
  // Happy arcs
  `<path d="M 28,46 Q 36,38 44,46" stroke="#0f172a" stroke-width="4.5" fill="none" />
   <path d="M 56,46 Q 64,38 72,46" stroke="#0f172a" stroke-width="4.5" fill="none" />`,
  // Bored lines
  `<line x1="28" y1="44" x2="44" y2="44" stroke="#0f172a" stroke-width="4.5" />
   <line x1="56" y1="44" x2="72" y2="44" stroke="#0f172a" stroke-width="4.5" />`,
  // Angry angled
  `<path d="M 28,38 L 44,44" stroke="#0f172a" stroke-width="4.5" />
   <path d="M 72,38 L 56,44" stroke="#0f172a" stroke-width="4.5" />
   <circle cx="36" cy="48" r="3.5" fill="#0f172a" />
   <circle cx="64" cy="48" r="3.5" fill="#0f172a" />`,
  // Shocked rings
  `<circle cx="36" cy="44" r="7" stroke="#0f172a" stroke-width="3" fill="none" />
   <circle cx="36" cy="44" r="2.5" fill="#0f172a" />
   <circle cx="64" cy="44" r="7" stroke="#0f172a" stroke-width="3" fill="none" />
   <circle cx="64" cy="44" r="2.5" fill="#0f172a" />`
];

const avatarMouths = [
  // Smile
  `<path d="M 32,60 Q 50,76 68,60" stroke="#0f172a" stroke-width="4.5" fill="none" />`,
  // Big open smile
  `<path d="M 32,58 Q 50,78 68,58 Z" fill="#ffffff" stroke="#0f172a" stroke-width="4" />`,
  // Sad Frown
  `<path d="M 32,68 Q 50,52 68,68" stroke="#0f172a" stroke-width="4.5" fill="none" />`,
  // Plain line
  `<line x1="36" y1="62" x2="64" y2="62" stroke="#0f172a" stroke-width="4.5" />`,
  // Shocked O
  `<circle cx="50" cy="64" r="6" fill="#0f172a" />`
];

// Local state
const avatarState = {
  colorIdx: 3, // Emerald green default
  eyesIdx: 0,
  mouthIdx: 0
};
let activeAvatarCustomTab = "color"; // color, eyes, mouth
let localPlayerName = "";
let currentDrawerId = null;
let currentLobbyState = null;
let myId = null;

// DOM Cache
const landingScreen = document.getElementById("landing-screen");
const gameScreen = document.getElementById("game-screen");

// Profile inputs
const nicknameInput = document.getElementById("nickname-input");
const avatarPreviewContainer = document.getElementById("avatar-preview-container");
const prevAvatarBtn = document.getElementById("prev-avatar-btn");
const nextAvatarBtn = document.getElementById("next-avatar-btn");
const customizeColorBtn = document.getElementById("customize-color-btn");
const customizeEyesBtn = document.getElementById("customize-eyes-btn");
const customizeMouthBtn = document.getElementById("customize-mouth-btn");

// Join buttons
const playBtn = document.getElementById("play-btn");
const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinCodeInput = document.getElementById("join-code-input");

// Game bar widgets
const roundValue = document.getElementById("round-value");
const wordDisplay = document.getElementById("word-display");
const wordLengthHint = document.getElementById("word-length-hint");
const timerValue = document.getElementById("timer-value");
const timerRingValue = document.getElementById("timer-ring-value");

// Panels
const playersList = document.getElementById("players-list");
const lobbySettingsPanel = document.getElementById("lobby-settings-panel");
const lobbyInviteBox = document.getElementById("lobby-invite-box");
const inviteCodeText = document.getElementById("invite-code-text");
const copyInviteBtn = document.getElementById("copy-invite-btn");
const startButton = document.getElementById("start-game-btn");
const settingsRounds = document.getElementById("settings-rounds");
const settingsTime = document.getElementById("settings-time");

// Overlays
const wordSelectOverlay = document.getElementById("word-select-overlay");
const wordOptionsContainer = document.getElementById("word-options-container");
const revealOverlay = document.getElementById("reveal-overlay");
const revealStatusTitle = document.getElementById("reveal-status-title");
const revealedWordValue = document.getElementById("revealed-word-value");
const roundScoresContainer = document.getElementById("round-scores-container");
const podiumOverlay = document.getElementById("podium-overlay");
const podiumContainer = document.getElementById("podium-container");
const returnToLobbyBtn = document.getElementById("return-to-lobby-btn");

// Toolbar buttons
const canvasToolbar = document.getElementById("canvas-toolbar");
const toolBrushBtn = document.getElementById("tool-brush");
const toolFillBtn = document.getElementById("tool-fill");
const toolEraserBtn = document.getElementById("tool-eraser");
const sizeBtns = document.querySelectorAll(".size-btn");
const colorBtns = document.querySelectorAll(".color-btn");
const undoActionBtn = document.getElementById("action-undo");
const clearActionBtn = document.getElementById("action-clear");

// Chats
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

/* ==========================================================================
   Initialization & Navigation Code
   ========================================================================== */

// Auto populate profile name from local storage if existing
const cachedName = localStorage.getItem("scribble_player_name");
if (cachedName) nicknameInput.value = cachedName;

// Auto-fill lobby code from URL query param if present
const urlParams = new URLSearchParams(window.location.search);
const lobbyCodeParam = urlParams.get("lobby");
if (lobbyCodeParam) {
  joinCodeInput.value = lobbyCodeParam;
}

// Generate unique avatar SVG string
function getAvatarSVG(avatar) {
  const color = avatarColors[avatar.colorIdx];
  const eyes = avatarEyes[avatar.eyesIdx];
  const mouth = avatarMouths[avatar.mouthIdx];
  
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="${color}" stroke="#0f172a" stroke-width="4.5" />
      <g>${eyes}</g>
      <g>${mouth}</g>
    </svg>
  `;
}

function updateAvatarPreview() {
  avatarPreviewContainer.innerHTML = getAvatarSVG(avatarState);
}

// Setup avatar configuration customizers
customizeColorBtn.addEventListener("click", () => setActiveTab("color", customizeColorBtn));
customizeEyesBtn.addEventListener("click", () => setActiveTab("eyes", customizeEyesBtn));
customizeMouthBtn.addEventListener("click", () => setActiveTab("mouth", customizeMouthBtn));

function setActiveTab(tab, element) {
  activeAvatarCustomTab = tab;
  document.querySelectorAll(".avatar-custom-buttons button").forEach(btn => btn.classList.remove("active"));
  element.classList.add("active");
}

function cycleAvatarPart(direction) {
  const step = direction === "next" ? 1 : -1;
  
  if (activeAvatarCustomTab === "color") {
    avatarState.colorIdx = (avatarState.colorIdx + step + avatarColors.length) % avatarColors.length;
  } else if (activeAvatarCustomTab === "eyes") {
    avatarState.eyesIdx = (avatarState.eyesIdx + step + avatarEyes.length) % avatarEyes.length;
  } else if (activeAvatarCustomTab === "mouth") {
    avatarState.mouthIdx = (avatarState.mouthIdx + step + avatarMouths.length) % avatarMouths.length;
  }
  updateAvatarPreview();
}

prevAvatarBtn.addEventListener("click", () => cycleAvatarPart("prev"));
nextAvatarBtn.addEventListener("click", () => cycleAvatarPart("next"));
updateAvatarPreview();

// Join Actions triggers
function joinLobby(lobbyCode = null) {
  const name = nicknameInput.value.trim() || "Artist " + Math.floor(Math.random() * 1000);
  localStorage.setItem("scribble_player_name", name);
  localPlayerName = name;

  socket.emit("join-lobby", {
    name,
    avatar: avatarState,
    lobbyCode
  });
}

playBtn.addEventListener("click", () => joinLobby(null));
createRoomBtn.addEventListener("click", () => {
  // To create a private room, we join with an empty code that is handled as a public lobby,
  // or we can tell the server to create a custom lobby. In our server.js, any join without a code is public.
  // Let's modify join room code to handle creation: if we pass 'CREATE_PRIVATE', server can handle it.
  // Wait! In server.js we had: if (lobbyCode) { find } else { find public / create public }.
  // Let's make sure creating a private lobby works. We can send a flag, or we can update server.js.
  // Wait! Let's check server.js line 280:
  // "socket.on('join-lobby', ({ name, avatar, lobbyCode }) => { ... if (lobbyCode) { ... } else { find public ... } })"
  // Let's modify our client-side app to send a create action, OR we can modify server.js to support 'CREATE'!
  // Wait, let's look at server.js: we can easily edit server.js if needed.
  // Let's see what happens if we join with "CREATE_PRIVATE" as the lobbyCode.
  // Server will look for lobby 'CREATE_PRIVATE', not find it, and say "Lobby not found!".
  // Ah! We need to make sure the server supports private lobby creation.
  // Let's check how the server supports creating a private lobby. We did NOT implement a separate "create-private" socket event in server.js, but we can update server.js, OR we can handle it inside "join-lobby" if lobbyCode === "__NEW_PRIVATE__".
  // Yes! If we pass `lobbyCode = "__NEW_PRIVATE__"` in `join-lobby`, we can create a private lobby on the server.
  // Let's check if server.js has this. Currently server.js checks `if (lobbyCode) { ... }`.
  // Let's edit server.js to check `if (lobbyCode && lobbyCode !== "__NEW_PRIVATE__")`.
  // If `lobbyCode === "__NEW_PRIVATE__"`, we create a new private lobby:
  // ```javascript
  // const id = generateLobbyId();
  // lobby = { id, isPrivate: true, creatorId: socket.id, ... };
  // lobbies.set(id, lobby);
  // ```
  // That is perfect! We will make a contiguous file edit to `server.js` to support this.
  // Let's propose this edit to `server.js` right now before writing `app.js` or in parallel.
  // Wait! Let's write `app.js` first, and then make the change to `server.js`.
  socket.emit("join-lobby", {
    name,
    avatar: avatarState,
    lobbyCode: "__NEW_PRIVATE__"
  });
});

joinRoomBtn.addEventListener("click", () => {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length === 6) {
    joinLobby(code);
  } else {
    alert("Please enter a valid 6-character room code!");
  }
});

copyInviteBtn.addEventListener("click", () => {
  const code = inviteCodeText.textContent;
  const inviteUrl = `${window.location.origin}/?lobby=${code}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    const originalContent = copyInviteBtn.innerHTML;
    copyInviteBtn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--accent-success);"></i>`;
    setTimeout(() => {
      copyInviteBtn.innerHTML = originalContent;
    }, 1500);
  });
});

// Leave/Home button
document.getElementById("leave-game-btn").addEventListener("click", () => {
  window.location.href = "/";
});

/* ==========================================================================
   Socket.io Handlers
   ========================================================================== */

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("error-message", (msg) => {
  alert(msg);
});

// Primary Game State Updates
socket.on("lobby-update", (lobbyState) => {
  currentLobbyState = lobbyState;
  
  // Transition screens
  landingScreen.classList.remove("active");
  gameScreen.classList.add("active");

  // Sync state
  gameState = lobbyState.state;
  currentDrawerId = lobbyState.currentDrawer;
  
  // 1. Update leaderboard list
  renderLeaderboard(lobbyState.players);
  
  // 2. Manage Top bar values
  roundValue.textContent = `${lobbyState.currentRound}/${lobbyState.settings.rounds}`;
  
  // 3. Handle Host privileges & settings visibility
  const isHost = lobbyState.players.find(p => p.id === myId)?.isHost;
  if (isHost && gameState === "LOBBY") {
    lobbySettingsPanel.classList.remove("hidden");
    // Set form selects
    settingsRounds.value = lobbyState.settings.rounds;
    settingsTime.value = lobbyState.settings.drawTime;
  } else {
    lobbySettingsPanel.classList.add("hidden");
  }

  // 4. Handle Invite Code box
  if (lobbyState.isPrivate) {
    lobbyInviteBox.classList.remove("hidden");
    inviteCodeText.textContent = lobbyState.id;
    // Update URL query param quietly for shareability
    window.history.replaceState(null, "", `?lobby=${lobbyState.id}`);
  } else {
    lobbyInviteBox.classList.add("hidden");
  }

  // 5. State Machine Views & Overlays toggles
  resetOverlays();
  
  if (gameState === "LOBBY") {
    wordDisplay.textContent = "WAITING FOR START";
    wordLengthHint.textContent = "";
    whiteboard.setInteractive(false);
    canvasToolbar.classList.add("hidden");
    whiteboard.clear();
  } 
  else if (gameState === "WORD_CHOICE") {
    const isMyTurn = currentDrawerId === myId;
    if (isMyTurn) {
      wordDisplay.textContent = "CHOOSE A WORD";
      wordLengthHint.textContent = "";
      wordSelectOverlay.classList.remove("hidden");
      // Populate choice buttons
      wordOptionsContainer.innerHTML = "";
      lobbyState.wordChoices.forEach(word => {
        const btn = document.createElement("button");
        btn.className = "word-choice-btn";
        btn.textContent = word;
        btn.addEventListener("click", () => {
          socket.emit("select-word", { word });
          wordSelectOverlay.classList.add("hidden");
        });
        wordOptionsContainer.appendChild(btn);
      });
      whiteboard.setInteractive(false);
      canvasToolbar.classList.add("hidden");
    } else {
      const drawerName = lobbyState.players.find(p => p.id === currentDrawerId)?.name || "Someone";
      wordDisplay.textContent = "CHOOSING WORD...";
      wordLengthHint.textContent = `${drawerName} is selecting a word`;
      whiteboard.setInteractive(false);
      canvasToolbar.classList.add("hidden");
    }
  } 
  else if (gameState === "DRAWING") {
    const isMyTurn = currentDrawerId === myId;
    if (isMyTurn) {
      wordDisplay.textContent = lobbyState.currentWord;
      wordLengthHint.textContent = "YOUR TURN TO DRAW!";
      whiteboard.setInteractive(true);
      canvasToolbar.classList.remove("hidden");
      chatInput.disabled = true;
      chatInput.placeholder = "You are drawing!";
    } else {
      wordDisplay.textContent = lobbyState.hints;
      const cleanHint = lobbyState.hints.replace(/\s+/g, "");
      wordLengthHint.textContent = `${cleanHint.length} letters`;
      whiteboard.setInteractive(false);
      canvasToolbar.classList.add("hidden");
      
      const me = lobbyState.players.find(p => p.id === myId);
      if (me?.guessed) {
        chatInput.disabled = false;
        chatInput.placeholder = "Type in secret guesser-chat...";
      } else {
        chatInput.disabled = false;
        chatInput.placeholder = "Type your guess here...";
      }
    }
  } 
  else if (gameState === "INTERMISSION") {
    wordDisplay.textContent = lobbyState.currentWord;
    wordLengthHint.textContent = "TURN COMPLETED";
    whiteboard.setInteractive(false);
    canvasToolbar.classList.add("hidden");
    
    // Setup intermission scoreboard overlay
    revealOverlay.classList.remove("hidden");
    revealedWordValue.textContent = lobbyState.currentWord;
    
    const drawerName = lobbyState.players.find(p => p.id === currentDrawerId)?.name || "Drawer";
    const drawerScoreEarned = lobbyState.players.find(p => p.id === currentDrawerId)?.roundScore || 0;
    
    revealStatusTitle.textContent = "Reveal Time!";
    
    // Sort players who earned points
    roundScoresContainer.innerHTML = "";
    
    // Render round scoring list
    lobbyState.players.forEach(p => {
      const row = document.createElement("div");
      row.className = "round-score-row";
      
      const nameDiv = document.createElement("div");
      nameDiv.className = "name";
      nameDiv.innerHTML = `${getAvatarSVG(p.avatar)} ${p.name}`;
      
      const scoreDiv = document.createElement("div");
      if (p.id === currentDrawerId) {
        scoreDiv.className = "score-earned";
        scoreDiv.textContent = `+${drawerScoreEarned} (Drawer)`;
      } else if (p.guessed) {
        scoreDiv.className = "score-earned";
        scoreDiv.textContent = `+${p.roundScore}`;
      } else {
        scoreDiv.className = "score-earned no-points";
        scoreDiv.textContent = `+0`;
      }
      
      row.appendChild(nameDiv);
      row.appendChild(scoreDiv);
      roundScoresContainer.appendChild(row);
    });
  } 
  else if (gameState === "GAME_OVER") {
    wordDisplay.textContent = "GAME OVER";
    wordLengthHint.textContent = "";
    whiteboard.setInteractive(false);
    canvasToolbar.classList.add("hidden");
    
    podiumOverlay.classList.remove("hidden");
    renderPodium(lobbyState.players);
  }
});

// Manage overlays helper
function resetOverlays() {
  wordSelectOverlay.classList.add("hidden");
  revealOverlay.classList.add("hidden");
  podiumOverlay.classList.add("hidden");
}

// Render Leaderboard in Left Panel
function renderLeaderboard(players) {
  // Sort players by total score
  const sorted = [...players].sort((a, b) => b.score - a.score);
  
  playersList.innerHTML = "";
  sorted.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "player-entry";
    if (p.id === currentDrawerId) item.classList.add("drawing");
    if (p.guessed && gameState === "DRAWING") item.classList.add("guessed");
    
    item.innerHTML = `
      <span class="rank-label">#${idx + 1}</span>
      <div class="player-avatar-mini">${getAvatarSVG(p.avatar)}</div>
      <div class="player-details">
        <div class="player-name">${escapeHTML(p.name)}</div>
        <div class="player-score">${p.score} points</div>
      </div>
    `;

    // Append status decorators
    if (p.id === currentDrawerId && gameState === "DRAWING") {
      item.innerHTML += `<div class="player-status-icon drawing-status"><i class="fa-solid fa-paintbrush"></i></div>`;
    } else if (p.guessed && gameState === "DRAWING") {
      item.innerHTML += `<div class="player-status-icon guessed-status"><i class="fa-solid fa-circle-check"></i></div>`;
    }

    if (p.isHost) {
      item.innerHTML += `<div class="player-host-icon" title="Host"><i class="fa-solid fa-crown"></i></div>`;
    }

    playersList.appendChild(item);
  });
}

// Render Winners Podium in Game Over state
function renderPodium(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  podiumContainer.innerHTML = "";

  // Standard positions mappings for 3-step podium display: [2nd, 1st, 3rd]
  const positions = [
    { rank: 2, data: sorted[1], class: "second" },
    { rank: 1, data: sorted[0], class: "first" },
    { rank: 3, data: sorted[2], class: "third" }
  ];

  positions.forEach(pos => {
    if (!pos.data) return; // If fewer than 3 players, skip empty ranks
    
    const step = document.createElement("div");
    step.className = `podium-position ${pos.class}`;
    step.innerHTML = `
      <div class="avatar-podium">${getAvatarSVG(pos.data.avatar)}</div>
      <div class="player-p-name">${escapeHTML(pos.data.name)}</div>
      <div class="player-p-score">${pos.data.score} pts</div>
      <div class="podium-step">${pos.rank}</div>
    `;
    podiumContainer.appendChild(step);
  });
}

// Host buttons listeners
startButton.addEventListener("click", () => {
  socket.emit("start-game");
});

settingsRounds.addEventListener("change", emitSettingsUpdate);
settingsTime.addEventListener("change", emitSettingsUpdate);

function emitSettingsUpdate() {
  socket.emit("change-settings", {
    rounds: settingsRounds.value,
    drawTime: settingsTime.value
  });
}

returnToLobbyBtn.addEventListener("click", () => {
  resetOverlays();
  // Return to lobby is done automatically by server timer after game over,
  // but button is there to dismiss visually early if desired or close.
});

// Timer coordination
socket.on("timer-update", ({ timer }) => {
  timerValue.textContent = timer;
  
  if (currentLobbyState) {
    const totalTime = gameState === "WORD_CHOICE" ? 15 : currentLobbyState.settings.drawTime;
    const perimeter = 125.6; // 2 * PI * 20
    const offset = perimeter - (timer / totalTime) * perimeter;
    timerRingValue.style.strokeDashoffset = offset;
    
    // Change timer circle color based on urgency
    if (timer <= 10) {
      timerRingValue.style.stroke = "var(--accent-error)";
    } else if (timer <= 25) {
      timerRingValue.style.stroke = "var(--accent-warning)";
    } else {
      timerRingValue.style.stroke = "var(--accent-primary)";
    }
  }
});

// Canvas sync events listeners
socket.on("drawing-event", (data) => {
  whiteboard.drawSegment(data.x0, data.y0, data.x1, data.y1, data.tool, data.color, data.size);
});

socket.on("fill-canvas", (data) => {
  whiteboard.executeFill(data.x, data.y, data.color);
});

socket.on("clear-canvas", () => {
  whiteboard.clear();
});

socket.on("canvas-history", (history) => {
  whiteboard.loadHistory(history);
});

socket.on("hints-update", ({ hints }) => {
  wordDisplay.textContent = hints;
});

// Connect whiteboard events to emit to sockets
whiteboard.onDrawSegment = (segment) => {
  socket.emit("drawing-event", segment);
};

whiteboard.onFill = (fillData) => {
  socket.emit("fill-canvas", fillData);
};

/* ==========================================================================
   Whiteboard Toolbar Event Handlers
   ========================================================================== */

// Tool select
toolBrushBtn.addEventListener("click", () => selectTool("brush", toolBrushBtn));
toolFillBtn.addEventListener("click", () => selectTool("fill", toolFillBtn));
toolEraserBtn.addEventListener("click", () => selectTool("eraser", toolEraserBtn));

function selectTool(toolName, element) {
  whiteboard.setTool(toolName);
  document.querySelectorAll(".tool-group button").forEach(btn => btn.classList.remove("active"));
  element.classList.add("active");
}

// Brush sizes select
sizeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    sizeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const size = parseInt(btn.dataset.size);
    whiteboard.setSize(size);
  });
});

// Colors select
colorBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    colorBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const color = btn.dataset.color;
    whiteboard.setColor(color);
  });
});

// Clear canvas action
clearActionBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the canvas?")) {
    whiteboard.clear();
    socket.emit("clear-canvas");
  }
});

// Undo canvas action
undoActionBtn.addEventListener("click", () => {
  socket.emit("undo-canvas");
});

/* ==========================================================================
   Chat Feed, Guesses & Notifications Log
   ========================================================================== */

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit("chat-message", text);
    chatInput.value = "";
  }
});

// ── Socket listeners for incoming chat messages & announcements ──
socket.on("chat-message", (data) => {
  renderChatMessage(data);
});

socket.on("chat-announcement", (announcement) => {
  renderChatAnnouncement(announcement);
});

socket.on("wrong-guess", (data) => {
  renderWrongGuess(data);
});

function getTimestampString() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderChatMessage(data) {
  const isMe = data.senderId === myId;
  const div = document.createElement("div");
  div.className = `chat-msg ${data.style || ""}`;
  if (isMe) div.classList.add("msg-self");

  const headerDiv = document.createElement("div");
  headerDiv.className = "msg-header";

  const senderSpan = document.createElement("span");
  senderSpan.className = "sender";
  senderSpan.textContent = isMe ? "You" : (data.name || "Guest");

  const timeSpan = document.createElement("span");
  timeSpan.className = "timestamp";
  timeSpan.textContent = getTimestampString();

  headerDiv.appendChild(senderSpan);
  headerDiv.appendChild(timeSpan);

  const textSpan = document.createElement("div");
  textSpan.className = "msg-text";
  textSpan.textContent = data.message;

  div.appendChild(headerDiv);
  div.appendChild(textSpan);
  chatMessages.appendChild(div);
  
  // Smooth scroll to bottom
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

// Render a wrong guess as a distinct styled entry
function renderWrongGuess(data) {
  const isMe = data.senderId === myId;
  const div = document.createElement("div");
  div.className = "chat-msg wrong-guess";
  if (isMe) div.classList.add("msg-self");

  const headerDiv = document.createElement("div");
  headerDiv.className = "msg-header";

  const senderSpan = document.createElement("span");
  senderSpan.className = "sender";
  senderSpan.textContent = isMe ? "You" : (data.name || "Guest");

  const timeSpan = document.createElement("span");
  timeSpan.className = "timestamp";
  timeSpan.textContent = getTimestampString();

  headerDiv.appendChild(senderSpan);
  headerDiv.appendChild(timeSpan);

  const bodyDiv = document.createElement("div");
  bodyDiv.className = "msg-body";

  const icon = document.createElement("span");
  icon.className = "guess-icon";
  icon.textContent = "❌ ";

  const textSpan = document.createElement("span");
  textSpan.className = "guess-word";
  textSpan.textContent = data.guess;

  bodyDiv.appendChild(icon);
  bodyDiv.appendChild(textSpan);

  div.appendChild(headerDiv);
  div.appendChild(bodyDiv);
  chatMessages.appendChild(div);
  
  // Smooth scroll to bottom
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

// Render system announcements (join, leave, success, reveal, etc.)
function renderChatAnnouncement(announcement) {
  const div = document.createElement("div");
  div.className = `system-msg ${announcement.type}`;
  
  const textSpan = document.createElement("span");
  textSpan.textContent = announcement.message;

  const timeSpan = document.createElement("span");
  timeSpan.className = "timestamp-sys";
  timeSpan.textContent = ` (${getTimestampString()})`;

  div.appendChild(textSpan);
  div.appendChild(timeSpan);
  chatMessages.appendChild(div);
  
  // Smooth scroll to bottom
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

// Success: show personal correct-guess celebration in chat
socket.on("correct-guess-event", ({ score }) => {
  const div = document.createElement("div");
  div.className = "system-msg success";
  div.textContent = `✅ Correct! You earned +${score} points. (${getTimestampString()})`;
  chatMessages.appendChild(div);
  
  // Smooth scroll to bottom
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
});

// Utility: HTML Escaper to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

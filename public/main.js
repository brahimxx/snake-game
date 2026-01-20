import { Snake, isOpposite } from "./snake.js";
import { randomFoodPosition } from "./food.js";
import { updateGridSize, render } from "./board.js";
import { updateScoreDisplay } from "./utils.js";

const GAME_CONFIG = {
  BOARD_SIZE: 600,
  DIFFICULTY_SPEED_INCREASE: 0.98, // Speed multiplier per food eaten
  MIN_INTERVAL_SPEED: 30, // Fastest possible game speed
};

const STORAGE_KEYS = {
  HIGH_SCORES: "snake_game_high_scores",
  SOUND_ENABLED: "snake_game_sound_enabled",
  PLAYER_NAME: "snake_game_player_name",
};

const GameState = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
};

const gameMenu = document.getElementById("gameMenu");
const startBtn = document.getElementById("startBtn");
const difficultyButtons = document.querySelectorAll(".diff-btn");
const menuHighScoreLabel = document.getElementById("menuHighScoreLabel");
const leaderboardList = document.getElementById("leaderboardList");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const soundIcon = document.getElementById("soundIcon");
const toast = document.getElementById("toast");

// Modal Elements
const modalPlayerName = document.getElementById("modalPlayerName");
const saveScoreBtn = document.getElementById("saveScoreBtn");
const newHighScoreSection = document.getElementById("newHighScoreSection");

const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const quitToMenuBtnGameOver = document.getElementById("quitToMenuBtn_gameOver");
const quitToMenuBtnPause = document.getElementById("quitToMenuBtn_pause");

const modal = document.getElementById("gameOverModal");
const playAgainBtn = document.getElementById("playAgainBtn");

const playBoard = document.querySelector(".game_board");
const mainDiv = document.querySelector(".main_div");

// Game state
let gameState = GameState.MENU;
let gameInterval = null;
let currentDifficulty = "normal"; // Default
let intervalSpeed = 100; // Default normal speed
let baseIntervalSpeed = intervalSpeed;
let gridRows = 0;
let gridCols = 0;
let snake;
let food;
let score = 0;
let highestScore = 0;
let leaderboardTopScore = 0; // Track the #5 score to know if we qualify
let leaderboardCount = 0; // Track number of entries

// Device Detection
// iPads on iOS 13+ pretend to be desktops (MacIntel) but have touch points.
const isMobile =
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;
const deviceType = isMobile ? "mobile" : "desktop";


// Sound setup
const hitSound = new Audio("sounds/hit.wav");
const eatSound = new Audio("sounds/eat.mp3");
let soundEnabled = loadSoundPreference();
// Set initial icon state
if (soundIcon) {
    soundIcon.src = soundEnabled ? "/images/icons/sound-on.svg" : "/images/icons/sound-off.svg";
}

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let isTouching = false;
const TOUCH_THRESHOLD = 30;

// ------------ Local Storage Helpers -------------
function loadSoundPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return saved === null ? true : saved === "true";
  } catch (e) {
    return true;
  }
}

function saveSoundPreference(enabled) {
  try {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, enabled.toString());
  } catch (e) {
    console.warn("Failed to save sound preference");
  }
}

const MAX_SCORES = 5;

// Returns { [difficulty]: [ {name, score}, ... ] }
function getAllLocalScores() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    const parsed = saved ? JSON.parse(saved) : {};
    // Migration: if strictly numbers (old format), reset or ignore
    if (parsed.easy && typeof parsed.easy === 'number') return {}; 
    return parsed;
  } catch (e) {
    return {};
  }
}

function getLocalLeaderboardData(difficulty) {
  const allScores = getAllLocalScores();
  return allScores[difficulty] || [];
}

function saveLocalLeaderboardData(difficulty, name, score) {
  const allScores = getAllLocalScores();
  const list = allScores[difficulty] || [];
  
  list.push({ name, score });
  // Sort desc
  list.sort((a, b) => b.score - a.score);
  // Keep top 5
  if (list.length > MAX_SCORES) {
    list.length = MAX_SCORES;
  }
  
  allScores[difficulty] = list;
  localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(allScores));
}

const highScoreCache = {};

async function fetchAndRenderLeaderboard(difficulty) {
  leaderboardList.innerHTML = "<li>Loading...</li>";
  
  let leaderboard = [];
  let isOffline = false;

  try {
    // Try API first
    const res = await fetch(`/api/highscore/${difficulty}?deviceType=${deviceType}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    leaderboard = data.leaderboard || [];
  } catch (error) {
    console.warn("Leaderboard sync failed, using local storage:", error);
    isOffline = true;
    leaderboard = getLocalLeaderboardData(difficulty);
  }

  // Render logic common for both API and Local
  if (leaderboard.length > 0) {
    leaderboardList.innerHTML = leaderboard
      .map(
        (entry, index) =>
          `<li><span>#${index + 1} ${entry.name || entry.player_name || "Anonymous"}</span> <span>${entry.score}</span></li>`
      )
      .join("");
      
    // Update game logic variables
    highestScore = leaderboard[0].score;
    const lastEntry = leaderboard[leaderboard.length - 1];
    leaderboardTopScore = leaderboard.length < MAX_SCORES ? 0 : lastEntry.score;
    leaderboardCount = leaderboard.length;
  } else {
    leaderboardList.innerHTML = "<li>No scores yet</li>";
    highestScore = 0;
    leaderboardTopScore = 0;
    leaderboardCount = 0;
  }

  return highestScore;
}

function getCachedHighScore(difficulty) {
  return highScoreCache[difficulty] ?? 0;
}

async function storeHighScore(score, difficulty, nameParam) {
  const name = nameParam || "Anonymous";
  
  // Always save locally first (robustness)
  saveLocalLeaderboardData(difficulty, name, score);

  // Try to save to API
  try {
    const res = await fetch(`/api/highscore/${difficulty}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, name, deviceType }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    console.warn("Failed to save high score to API:", error);
  }
  
  // Re-render (will use local if API failed)
  await fetchAndRenderLeaderboard(difficulty);
}

async function updateMenuHighScore() {
  await fetchAndRenderLeaderboard(currentDifficulty);
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("hidden");
    }, 3000);
}

function playSound(sound) {
  if (soundEnabled) {
    sound.currentTime = 0;
    sound.play().catch((e) => console.warn("Sound play failed:", e));
  }
}

// --- Initial state
function setGameState(newState) {
  gameState = newState;

  // Update UI based on state
  gameMenu.classList.toggle("show", newState === GameState.MENU);
  pauseOverlay.classList.toggle("show", newState === GameState.PAUSED);
  modal.classList.toggle("show", newState === GameState.GAME_OVER);

  // Reset modal state when showing/hiding
  if (newState !== GameState.GAME_OVER) {
    newHighScoreSection.classList.add("hidden");
    modalPlayerName.value = "";
  }

  // Show/hide game board
  mainDiv.classList.toggle("hidden", newState === GameState.MENU);
}

setGameState(GameState.MENU);

// --- On page load
window.addEventListener("DOMContentLoaded", async () => {
  // Load saved name
  const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
  if (savedName) modalPlayerName.value = savedName;

  await fetchAndRenderLeaderboard(currentDifficulty);
  
  setupTouchControls();
  setupSoundToggle();
});

if (backToMenuBtn) {
  backToMenuBtn.addEventListener("click", () => {
    if (gameInterval) clearInterval(gameInterval);
    setGameState(GameState.MENU);
    updateMenuHighScore();
  });
}

// --- Touch Controls Setup
function setupTouchControls() {
  playBoard.addEventListener(
    "touchstart",
    (e) => {
      if (gameState !== GameState.PLAYING) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      lastTouchX = touchStartX;
      lastTouchY = touchStartY;
      isTouching = true;
    },
    { passive: true },
  );

  playBoard.addEventListener(
    "touchmove",
    (e) => {
      if (gameState !== GameState.PLAYING || !isTouching) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;

      // Calculate delta from last processed position
      const deltaX = touchX - lastTouchX;
      const deltaY = touchY - lastTouchY;

      // Check if movement exceeds threshold
      if (
        Math.abs(deltaX) < TOUCH_THRESHOLD &&
        Math.abs(deltaY) < TOUCH_THRESHOLD
      ) {
        return;
      }

      // Determine direction based on largest delta
      let newDirection = null;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newDirection = deltaX > 0 ? "right" : "left";
      } else {
        newDirection = deltaY > 0 ? "down" : "up";
      }

      if (newDirection) {
        snake.setDirection(newDirection);
        // Update last position to current for next swipe detection
        lastTouchX = touchX;
        lastTouchY = touchY;
      }
    },
    { passive: true },
  );

  playBoard.addEventListener(
    "touchend",
    (e) => {
      isTouching = false;
    },
    { passive: true },
  );

  playBoard.addEventListener(
    "touchcancel",
    (e) => {
      isTouching = false;
    },
    { passive: true },
  );
}

// --- Sound Toggle Setup
function setupSoundToggle() {
  const soundToggle = document.getElementById("soundToggle");
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      saveSoundPreference(soundEnabled);
      // Update Icon
      if (soundIcon) {
        soundIcon.src = soundEnabled ? "/images/icons/sound-on.svg" : "/images/icons/sound-off.svg";
      }
    });
  }
}

// --- Initialize Game
async function initializeGame() {
  gridRows = gridCols = updateGridSize(playBoard);
  const startY = Math.floor(gridRows / 2);
  const startX = Math.floor(gridCols / 2);
  snake = new Snake(startY, startX, gridRows, gridCols); // Pass grid size
  food = randomFoodPosition(gridRows, gridCols, snake.body);

  score = 0;
  // Map current difficulty string to speed
  const speedMap = { easy: 150, normal: 100, hard: 60 };
  baseIntervalSpeed = speedMap[currentDifficulty] || 100;
  intervalSpeed = baseIntervalSpeed;

  // highestScore is updated by fetchAndRenderLeaderboard already
  updateScoreDisplay(score, highestScore);
  render(playBoard, snake, food);

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, intervalSpeed);
  setGameState(GameState.PLAYING);
}

// --- Event Listeners

startBtn.addEventListener("click", async () => {
  await initializeGame();
});

difficultyButtons.forEach(btn => {
  btn.addEventListener("click", async (e) => {
    // UI Update
    const clickedBtn = e.currentTarget; // Safer than target
    difficultyButtons.forEach(b => b.classList.remove("active"));
    clickedBtn.classList.add("active");
    
    // Logic Update
    currentDifficulty = clickedBtn.dataset.diff;
    await updateMenuHighScore();
  });
});

playAgainBtn.addEventListener("click", async () => {
  await updateMenuHighScore();
  await initializeGame();
});

resumeBtn.addEventListener("click", () => {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, intervalSpeed);
  setGameState(GameState.PLAYING);
});

quitToMenuBtnGameOver.addEventListener("click", async () => {
  setGameState(GameState.MENU);
  await updateMenuHighScore();
});

quitToMenuBtnPause.addEventListener("click", async () => {
  setGameState(GameState.MENU);
  await updateMenuHighScore();
});

// Debounced resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const newGridSize = updateGridSize(playBoard);
    if (gameState === GameState.PLAYING && snake) {
      // Update grid size in game state and snake
      gridRows = gridCols = newGridSize;
      snake.updateGridSize(gridRows, gridCols);
      render(playBoard, snake, food);
    } else if (gameState === GameState.MENU) {
      // Just update the display for menu
      gridRows = gridCols = newGridSize;
    }
  }, 250);
});

// --- Keyboard Input
document.addEventListener("keydown", (event) => {
  // Pause logic
  if (event.key === "Escape" && gameState === GameState.PLAYING) {
    clearInterval(gameInterval);
    setGameState(GameState.PAUSED);
    return;
  }

  // Resume with Escape if paused
  if (event.key === "Escape" && gameState === GameState.PAUSED) {
    resumeBtn.click();
    return;
  }

  // Ignore movement keys if not playing
  if (gameState !== GameState.PLAYING) return;

  let newDirection = null;
  switch (event.key) {
    case "ArrowUp":
    case "w":
    case "W":
      newDirection = "up";
      break;
    case "ArrowDown":
    case "s":
    case "S":
      newDirection = "down";
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      newDirection = "left";
      break;
    case "ArrowRight":
    case "d":
    case "D":
      newDirection = "right";
      break;
  }

  if (newDirection) {
    event.preventDefault(); // Prevent scrolling
    snake.setDirection(newDirection);
  }
});

// ---- MAIN GAMELOOP with progressive difficulty
async function gameLoop() {
  // Process direction queue
  if (snake.directionQueue && snake.directionQueue.length > 0) {
    snake.direction = snake.directionQueue.shift();
  }

  // Check collision BEFORE moving - absolute prevention
  if (snake.willCollideOnNextMove()) {
    // Check if score qualifies for high score (top 5) or is simply > 0 to encourage saving
    // Check if score qualifies:
    // 1. Must be > 0
    // 2. AND (Leaderboard has < 5 slots filled OR Score beats the 5th place score)
    const qualifies = score > 0 && (leaderboardCount < 5 || score > leaderboardTopScore);
    
    // Play sound immediately
    playSound(hitSound);
    if (gameInterval) clearInterval(gameInterval);

    const gameMainDiv = document.querySelector(".main_div");
    gameMainDiv.classList.add("shake");
    gameMainDiv.addEventListener(
      "animationend",
      async () => {
        gameMainDiv.classList.remove("shake");
        setTimeout(async () => {
          setGameState(GameState.GAME_OVER);
          
          if (qualifies && score > 0) {
            newHighScoreSection.classList.remove("hidden");
            modalPlayerName.focus();
            
            // Setup save handler for this specific game over instance
            saveScoreBtn.onclick = async () => {
                const name = modalPlayerName.value.trim() || "Anonymous";
                localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name); // Save for next time
                await storeHighScore(score, currentDifficulty, name);
                saveScoreBtn.onclick = null; // Prevent double submit
                showToast("Score Saved!");
                newHighScoreSection.classList.add("hidden"); // Hide after save
                await updateMenuHighScore();
            };
          }
          
          await updateMenuHighScore();
        }, 300);
      },
      { once: true },
    );
    return;
  }

  // Move snake (safe to move now)
  snake.move();

  // Eat food
  if (snake.body[0].x === food.x && snake.body[0].y === food.y) {
    playSound(eatSound);
    snake.grow();
    food = randomFoodPosition(gridRows, gridCols, snake.body);
    score++;
    updateScoreDisplay(score, highestScore);

    // Progressive difficulty: increase speed slightly
    if (intervalSpeed > GAME_CONFIG.MIN_INTERVAL_SPEED) {
      intervalSpeed = Math.max(
        GAME_CONFIG.MIN_INTERVAL_SPEED,
        Math.floor(intervalSpeed * GAME_CONFIG.DIFFICULTY_SPEED_INCREASE),
      );
      // Restart interval with new speed
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, intervalSpeed);
    }
  }

  render(playBoard, snake, food);
}

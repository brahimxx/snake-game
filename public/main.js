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
};

const GameState = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
};

const gameMenu = document.getElementById("gameMenu");
const startBtn = document.getElementById("startBtn");
const difficultySelect = document.getElementById("difficultySelect");
const menuHighScoreLabel = document.getElementById("menuHighScoreLabel");

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
let intervalSpeed = parseInt(difficultySelect.value, 10);
let baseIntervalSpeed = intervalSpeed; // Store initial speed
let gridRows = 0;
let gridCols = 0;
let snake;
let food;
let score = 0;
let highestScore = 0;

let currentDifficulty = difficultySelect.options[
  difficultySelect.selectedIndex
].text
  .trim()
  .toLowerCase();

// Sound setup
const hitSound = new Audio("sounds/hit.wav");
const eatSound = new Audio("sounds/eat.mp3");
let soundEnabled = loadSoundPreference();

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

function getLocalHighScores() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalHighScore(difficulty, score) {
  try {
    const scores = getLocalHighScores();
    scores[difficulty] = Math.max(scores[difficulty] || 0, score);
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(scores));
  } catch (e) {
    console.warn("Failed to save high score locally");
  }
}

const highScoreCache = {};

async function fetchAndCacheHighScore(difficulty) {
  if (highScoreCache[difficulty] !== undefined) {
    return highScoreCache[difficulty];
  }

  // Show local data immediately for instant loading
  const localScores = getLocalHighScores();
  const localScore = localScores[difficulty] || 0;
  highScoreCache[difficulty] = localScore;

  // Then fetch from API in background to sync
  fetch(`/api/highscore/${difficulty}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      // Update if API has higher score
      if (data.score > localScore) {
        highScoreCache[difficulty] = data.score;
        // Update display if we're on menu
        if (gameState === GameState.MENU) {
          menuHighScoreLabel.textContent = data.score;
        }
      }
    })
    .catch((error) => {
      console.warn("API sync failed, using local score:", error);
    });

  return localScore;
}

function getCachedHighScore(difficulty) {
  return highScoreCache[difficulty] ?? 0;
}

async function storeHighScore(score, difficulty) {
  // Always save locally
  saveLocalHighScore(difficulty, score);

  // Try to save to API
  try {
    const res = await fetch(`/api/highscore/${difficulty}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    highScoreCache[difficulty] = score;
  } catch (error) {
    console.warn("Failed to save high score to API:", error);
    // Local storage already updated above
    highScoreCache[difficulty] = score;
  }
}

async function updateMenuHighScore() {
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  menuHighScoreLabel.textContent = highestScore;
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

  // Show/hide game board
  mainDiv.classList.toggle("hidden", newState === GameState.MENU);
}

setGameState(GameState.MENU);

// --- On page load
window.addEventListener("DOMContentLoaded", async () => {
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  menuHighScoreLabel.textContent = highestScore;
  setupTouchControls();
  setupSoundToggle();
});

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
  // Create sound toggle button (will be added to HTML)
  const soundToggle = document.getElementById("soundToggle");
  if (soundToggle) {
    soundToggle.textContent = soundEnabled ? "🔊" : "🔇";
    soundToggle.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      saveSoundPreference(soundEnabled);
      soundToggle.textContent = soundEnabled ? "🔊" : "🔇";
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
  baseIntervalSpeed = parseInt(difficultySelect.value, 10);
  intervalSpeed = baseIntervalSpeed;
  highestScore = getCachedHighScore(currentDifficulty);
  updateScoreDisplay(score, highestScore);
  render(playBoard, snake, food);

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, intervalSpeed);
  setGameState(GameState.PLAYING);
}

// --- Event Listeners

startBtn.addEventListener("click", async () => {
  intervalSpeed = parseInt(difficultySelect.value, 10);
  currentDifficulty = difficultySelect.options[
    difficultySelect.selectedIndex
  ].text
    .trim()
    .toLowerCase();
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  await initializeGame();
});

difficultySelect.addEventListener("change", async (event) => {
  intervalSpeed = parseInt(event.target.value, 10);
  currentDifficulty = difficultySelect.options[
    difficultySelect.selectedIndex
  ].text
    .trim()
    .toLowerCase();
  await updateMenuHighScore();
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
    if (score > getCachedHighScore(currentDifficulty)) {
      highestScore = score;
      await storeHighScore(highestScore, currentDifficulty);
    }
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
    updateScoreDisplay(score, getCachedHighScore(currentDifficulty));

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

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
const finalScoreSpan = document.getElementById("finalScore");
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
let currentLeaderboard = []; // Store current leaderboard data

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
  soundIcon.src = soundEnabled
    ? "/images/icons/sound-on.svg"
    : "/images/icons/sound-off.svg";
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

function showToast(message) {
  if (toast) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      // Don't add "hidden" class, let it fade out with opacity
    }, 3000);
  }
}

const MAX_SCORES = 5;

// Returns { [difficulty]: [ {name, score}, ... ] }
function getAllLocalScores() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    const parsed = saved ? JSON.parse(saved) : {};
    // Migration: if strictly numbers (old format), reset or ignore
    if (parsed.easy && typeof parsed.easy === "number") return {};
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
const CACHE_DURATION = 30000; // 30 seconds
let lastFetchTime = {};

async function fetchAndRenderLeaderboard(difficulty) {
  const now = Date.now();
  const cacheKey = `${difficulty}_${deviceType}`;

  // Use cached data if recent
  if (
    highScoreCache[cacheKey] &&
    lastFetchTime[cacheKey] &&
    now - lastFetchTime[cacheKey] < CACHE_DURATION
  ) {
    renderLeaderboard(highScoreCache[cacheKey]);
    return highScoreCache[cacheKey][0]?.score || 0;
  }

  // Show local data immediately, then update with fresh data
  const localData = getLocalLeaderboardData(difficulty);
  if (localData.length > 0) {
    renderLeaderboard(localData);
  } else {
    showLeaderboardSkeleton();
  }

  // Fetch fresh data in background (non-blocking)
  fetchFreshLeaderboardData(difficulty, cacheKey, now);

  return localData[0]?.score || 0;
}

function showLeaderboardSkeleton() {
  leaderboardList.innerHTML = Array.from({ length: 5 }, (_, index) => {
    return `<li class="skeleton-item">
      <div class="skeleton-rank"></div>
      <div class="skeleton-name"></div>
      <div class="skeleton-score"></div>
    </li>`;
  }).join("");
}

async function fetchFreshLeaderboardData(difficulty, cacheKey, startTime) {
  try {
    const fetchStart = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const res = await fetch(
      `/api/highscore/${difficulty}?deviceType=${deviceType}`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const leaderboard = data.leaderboard || [];

    const fetchEnd = Date.now();

    // Update cache
    highScoreCache[cacheKey] = leaderboard;
    lastFetchTime[cacheKey] = startTime;

    // Update UI with fresh data
    renderLeaderboard(leaderboard);
  } catch (error) {
    // Keep using local data - no need to show error to user
  }
}

function renderLeaderboard(leaderboard) {
  // Render logic common for both API and Local
  if (leaderboard.length > 0) {
    leaderboardList.innerHTML = leaderboard
      .map((entry, index) => {
        const playerName = entry.name || entry.player_name || "Anonymous";
        const isIkrame = playerName.toLowerCase() === "ikrame";
        const cssClass = isIkrame ? ' class="ikrame-special"' : '';
        return `<li${cssClass}><span>#${index + 1} ${playerName}</span> <span>${entry.score}</span></li>`;
      })
      .join("");

    // Update game logic variables
    highestScore = leaderboard[0].score;
    leaderboardCount = leaderboard.length;
    currentLeaderboard = [...leaderboard]; // Store copy of current leaderboard

    // Set the minimum score needed to qualify for top 5
    // If leaderboard has < 5 entries, any score > 0 qualifies
    // If leaderboard has 5 entries, need to beat the 5th place score
    if (leaderboardCount < MAX_SCORES) {
      leaderboardTopScore = 0; // Any positive score qualifies
    } else {
      leaderboardTopScore = leaderboard[MAX_SCORES - 1].score; // 5th place score
    }
  } else {
    leaderboardList.innerHTML = "<li>No scores yet</li>";
    highestScore = 0;
    leaderboardTopScore = 0; // Any positive score qualifies when empty
    leaderboardCount = 0;
    currentLeaderboard = []; // Empty leaderboard
  }

  return highestScore;
}

function getCachedHighScore(difficulty) {
  return highScoreCache[difficulty] ?? 0;
}

async function updateMenuHighScore() {
  await fetchAndRenderLeaderboard(currentDifficulty);
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

    // Invalidate cache after successful save
    const cacheKey = `${difficulty}_${deviceType}`;
    delete highScoreCache[cacheKey];
    delete lastFetchTime[cacheKey];
  } catch (error) {
    console.warn("Failed to save high score to API:", error);
  }

  // Re-render with fresh data
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
        soundIcon.src = soundEnabled
          ? "/images/icons/sound-on.svg"
          : "/images/icons/sound-off.svg";
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

difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    // UI Update
    const clickedBtn = e.currentTarget; // Safer than target
    difficultyButtons.forEach((b) => b.classList.remove("active"));
    clickedBtn.classList.add("active");

    // Logic Update
    const newDifficulty = clickedBtn.dataset.diff;
    currentDifficulty = newDifficulty;

    // Clear cache for immediate update
    const cacheKey = `${currentDifficulty}_${deviceType}`;
    delete highScoreCache[cacheKey];
    delete lastFetchTime[cacheKey];

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

          // Get fresh leaderboard data to check qualification
          let currentLeaderboardData = [];
          try {
            const res = await fetch(
              `/api/highscore/${currentDifficulty}?deviceType=${deviceType}`,
            );
            if (res.ok) {
              const data = await res.json();
              currentLeaderboardData = data.leaderboard || [];
            } else {
              currentLeaderboardData =
                getLocalLeaderboardData(currentDifficulty);
            }
          } catch (error) {
            currentLeaderboardData = getLocalLeaderboardData(currentDifficulty);
          }

          // Determine if score qualifies for high score (top 5)
          // Only show "New High Score" if the score actually beats existing scores
          let qualifies = false;

          if (score > 0) {
            if (currentLeaderboardData.length === 0) {
              // Empty leaderboard - only qualify if score is decent (5+)
              qualifies = score >= 5;
            } else if (currentLeaderboardData.length < MAX_SCORES) {
              // Leaderboard not full - any positive score qualifies
              qualifies = true;
            } else {
              // Leaderboard is full - must beat the worst (last) score to qualify
              const worstScore =
                currentLeaderboardData[currentLeaderboardData.length - 1].score;
              qualifies = score > worstScore;
            }
          } else {
            // Score is 0, never qualifies
            qualifies = false;
          }

          // Always show the final score
          if (finalScoreSpan) {
            finalScoreSpan.textContent = score;
          }

          // Update score status message
          const scoreStatus = document.getElementById("scoreStatus");
          if (scoreStatus) {
            if (qualifies) {
              scoreStatus.innerHTML =
                '<span class="high-score-indicator">🎉 You made the top 5!</span>';
              scoreStatus.className = "score-status success";
            } else if (score === 0) {
              scoreStatus.innerHTML =
                '<span class="try-again-message">Try again to get on the leaderboard!</span>';
              scoreStatus.className = "score-status neutral";
            } else {
              let neededScore = 5; // default minimum for empty leaderboard
              if (currentLeaderboardData.length > 0) {
                if (currentLeaderboardData.length < MAX_SCORES) {
                  const worstExisting = Math.min(
                    ...currentLeaderboardData.map((entry) => entry.score),
                  );
                  neededScore = worstExisting + 1;
                } else {
                  neededScore =
                    currentLeaderboardData[MAX_SCORES - 1].score + 1;
                }
              }
              scoreStatus.innerHTML = `<span class="score-needed">Need ${neededScore}+ points to make the top 5</span>`;
              scoreStatus.className = "score-status info";
            }
          }

          // Show/hide high score section based on qualification
          // ALWAYS hide first, then conditionally show
          newHighScoreSection.classList.add("hidden");

          if (qualifies) {
            newHighScoreSection.classList.remove("hidden");
            modalPlayerName.focus();

            // Setup save handler for this specific game over instance
            saveScoreBtn.onclick = async () => {
              const name = modalPlayerName.value.trim() || "Anonymous";

              // Show loading state
              const originalText = saveScoreBtn.textContent;
              saveScoreBtn.textContent = "Saving...";
              saveScoreBtn.disabled = true;

              localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name); // Save for next time

              try {
                await storeHighScore(score, currentDifficulty, name);
                saveScoreBtn.onclick = null; // Prevent double submit
                showToast("🎉 Score Saved Successfully!");
                newHighScoreSection.classList.add("hidden"); // Hide after save
                scoreStatus.innerHTML =
                  '<span class="score-saved">✅ Score saved to leaderboard!</span>';
                scoreStatus.className = "score-status success";
                await updateMenuHighScore();
              } catch (error) {
                // Reset button on error
                saveScoreBtn.textContent = originalText;
                saveScoreBtn.disabled = false;
                showToast("❌ Failed to save score. Try again.");
              }
            };
          } else {
            newHighScoreSection.classList.add("hidden");
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

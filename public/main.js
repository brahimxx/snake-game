import { Snake, isOpposite } from "./snake.js"; // NOTE: Import isOpposite!
import { randomFoodPosition } from "./food.js";
import { updateGridSize, render } from "./board.js";
import { updateScoreDisplay } from "./utils.js";

// --- Overlay/Menu Elements
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

let gameInterval = null;
let isPaused = false;
let isGameRunning = false;

let intervalSpeed = parseInt(difficultySelect.value, 10); // ms per frame
let gridRows = 0,
  gridCols = 0;
let snake,
  food,
  score = 0,
  highestScore = 0;

let currentDifficulty = difficultySelect.options[
  difficultySelect.selectedIndex
].text
  .trim()
  .toLowerCase();

// Sound setup
const hitSound = new Audio("sounds/hit.wav");
const eatSound = new Audio("sounds/eat.wav");

// ------------ High Score Cache/Helpers -------------
const highScoreCache = {}; // {easy: 10, medium: 23, ...}

async function fetchAndCacheHighScore(difficulty) {
  if (highScoreCache[difficulty] !== undefined) {
    return highScoreCache[difficulty];
  }
  const res = await fetch(`/api/highscore/${difficulty}`);
  const data = await res.json();
  highScoreCache[difficulty] = data.score;
  return data.score;
}

function getCachedHighScore(difficulty) {
  return highScoreCache[difficulty] ?? 0;
}

async function storeHighScore(score, difficulty) {
  await fetch(`/api/highscore/${difficulty}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score }),
  });
  highScoreCache[difficulty] = score; // update cache!
}

// ---- Helper (update menu)
async function updateMenuHighScore() {
  menuHighScoreLabel.textContent = "..."; // Indicate loading
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  menuHighScoreLabel.textContent = highestScore;
}

// --- Initial overlays state
gameMenu.classList.add("show");
pauseOverlay.classList.remove("show");
modal.classList.remove("show");

// --- On page load, cache the current difficulty's score
window.addEventListener("DOMContentLoaded", async () => {
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  menuHighScoreLabel.textContent = highestScore;
});

// --- Initialize Game
async function initializeGame() {
  gridRows = gridCols = updateGridSize(playBoard);
  const startY = Math.floor(gridRows / 2);
  const startX = Math.floor(gridCols / 2);
  snake = new Snake(startY, startX);
  food = randomFoodPosition(gridRows, gridCols, snake.body);

  score = 0;
  highestScore = getCachedHighScore(currentDifficulty);
  updateScoreDisplay(score, highestScore);
  render(playBoard, snake, food);

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, intervalSpeed);
  isPaused = false;
  isGameRunning = true;
}

// --- Event Listeners

startBtn.addEventListener("click", async () => {
  gameMenu.classList.remove("show");
  intervalSpeed = parseInt(difficultySelect.value, 10);
  currentDifficulty = difficultySelect.options[
    difficultySelect.selectedIndex
  ].text
    .trim()
    .toLowerCase();
  // Only fetch if not cached yet
  highestScore = await fetchAndCacheHighScore(currentDifficulty);
  await initializeGame();
  isGameRunning = true;
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
  modal.classList.remove("show");
  await updateMenuHighScore();
  await initializeGame();
  isGameRunning = true;
});

resumeBtn.addEventListener("click", () => {
  pauseOverlay.classList.remove("show");
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, intervalSpeed);
  isPaused = false;
});

quitToMenuBtnGameOver.addEventListener("click", async () => {
  pauseOverlay.classList.remove("show");
  modal.classList.remove("show");
  isGameRunning = false;
  gameMenu.classList.add("show");
  await updateMenuHighScore();
});
quitToMenuBtnPause.addEventListener("click", async () => {
  pauseOverlay.classList.remove("show");
  modal.classList.remove("show");
  isGameRunning = false;
  gameMenu.classList.add("show");
  await updateMenuHighScore();
});

window.addEventListener("resize", () => {
  gridRows = gridCols = updateGridSize(playBoard);
  render(playBoard, snake, food);
});

// --- Keyboard Input
document.addEventListener("keydown", (event) => {
  // Pause logic
  if (
    event.key === "Escape" &&
    isGameRunning &&
    !isPaused &&
    !modal.classList.contains("show")
  ) {
    isPaused = true;
    clearInterval(gameInterval);
    pauseOverlay.classList.add("show");
    return;
  }
  // Resume with Escape if paused
  if (event.key === "Escape" && isPaused) {
    resumeBtn.click();
    return;
  }

  // Ignore movement keys if not running or paused
  if (!isGameRunning || isPaused || modal.classList.contains("show")) return;

  let newDirection = null;
  switch (event.key) {
    case "ArrowUp":
      newDirection = "up";
      break;
    case "ArrowDown":
      newDirection = "down";
      break;
    case "ArrowLeft":
      newDirection = "left";
      break;
    case "ArrowRight":
      newDirection = "right";
      break;
  }
  if (newDirection) {
    snake.setDirection(newDirection); // This now queues directions
  }
});

// ---- MAIN GAMELOOP
async function gameLoop() {
  if (snake.directionQueue && snake.directionQueue.length > 0) {
    snake.direction = snake.directionQueue.shift();
  }
  snake.move(gridRows, gridCols);

  // Self-collision
  if (snake.hasSelfCollision()) {
    if (score > getCachedHighScore(currentDifficulty)) {
      highestScore = score;
      await storeHighScore(highestScore, currentDifficulty); // updates cache
    }
    hitSound.currentTime = 0;
    hitSound.play();
    if (gameInterval) clearInterval(gameInterval);

    const gameMainDiv = document.querySelector(".main_div");
    gameMainDiv.classList.add("shake");
    gameMainDiv.addEventListener(
      "animationend",
      async () => {
        gameMainDiv.classList.remove("shake");
        setTimeout(async () => {
          modal.classList.add("show");
          isGameRunning = false;
          await updateMenuHighScore();
        }, 300);
      },
      { once: true }
    );
    return;
  }

  // Eat food
  if (snake.body[0].x === food.x && snake.body[0].y === food.y) {
    eatSound.currentTime = 0;
    eatSound.play();
    snake.grow();
    food = randomFoodPosition(gridRows, gridCols, snake.body);
    score++;
    updateScoreDisplay(score, getCachedHighScore(currentDifficulty));
  }

  render(playBoard, snake, food);
}

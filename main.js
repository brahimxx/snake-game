import { Snake } from "./snake.js";
import { randomFoodPosition } from "./food.js";
import { updateGridSize, render } from "./board.js";
// REMOVE: import { getHighestScore, setHighestScore } from "./storage.js";
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
const turnSound = new Audio("sounds/change_direction.wav");
const hitSound = new Audio("sounds/hit.wav");
const eatSound = new Audio("sounds/eat.wav");

// ------------ High Score API helpers -------------
// Use these instead of direct storage.js import
async function fetchHighScore(difficulty) {
  const res = await fetch(`/api/highscore/${difficulty}`);
  const data = await res.json();
  return data.score;
}
async function storeHighScore(score, difficulty) {
  await fetch(`/api/highscore/${difficulty}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score }),
  });
}
// -------------------------------------------------

// ---- Helper
async function updateMenuHighScore() {
  highestScore = await fetchHighScore(currentDifficulty);
  menuHighScoreLabel.textContent = highestScore;
}
updateMenuHighScore();

// --- Initial overlays state
gameMenu.classList.add("show");
pauseOverlay.classList.remove("show");
modal.classList.remove("show");

// Async initializeGame must wait for API call
async function initializeGame() {
  gridRows = gridCols = updateGridSize(playBoard);
  const startY = Math.floor(gridRows / 2);
  const startX = Math.floor(gridCols / 2);
  snake = new Snake(startY, startX);
  food = randomFoodPosition(gridRows, gridCols, snake.body);

  // Always get correct score at start
  score = 0;
  highestScore = await fetchHighScore(currentDifficulty);
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

function isOpposite(dir1, dir2) {
  return (
    (dir1 === "up" && dir2 === "down") ||
    (dir1 === "down" && dir2 === "up") ||
    (dir1 === "left" && dir2 === "right") ||
    (dir1 === "right" && dir2 === "left")
  );
}

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
  if (
    newDirection &&
    snake.direction !== newDirection &&
    !isOpposite(snake.direction, newDirection)
  ) {
    snake.setDirection(newDirection);
    turnSound.currentTime = 0;
    turnSound.play();
  }
});

// ---- MAIN GAMELOOP
async function gameLoop() {
  snake.move(gridRows, gridCols);

  // Self-collision
  if (snake.hasSelfCollision()) {
    if (score > highestScore) {
      highestScore = score;
      await storeHighScore(highestScore, currentDifficulty);
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
    updateScoreDisplay(score, highestScore);
  }

  render(playBoard, snake, food);
}

// main.js
import { Snake } from "./snake.js";
import { randomFoodPosition } from "./food.js";
import { updateGridSize, render } from "./board.js";
import { getHighestScore, setHighestScore } from "./storage.js";
import { updateScoreDisplay } from "./utils.js";

const modal = document.getElementById("gameOverModal");
const playAgainBtn = document.getElementById("playAgainBtn");

let gameInterval = null;

const turnSound = new Audio("sounds/change_direction.wav");
const hitSound = new Audio("sounds/hit.wav");
const eatSound = new Audio("sounds/eat.wav");

playAgainBtn.addEventListener("click", () => {
  modal.classList.remove("show");
  initializeGame();
});

const playBoard = document.querySelector(".game_board");
let gridRows = 0,
  gridCols = 0;
let snake,
  food,
  score = 0,
  highestScore = getHighestScore();

function initializeGame() {
  gridRows = gridCols = updateGridSize(playBoard);
  const startY = Math.floor(gridRows / 2);
  const startX = Math.floor(gridCols / 2);
  snake = new Snake(startY, startX);
  food = randomFoodPosition(gridRows, gridCols, snake.body);

  score = 0;
  updateScoreDisplay(score, highestScore);
  render(playBoard, snake, food);

  // Clear any existing interval before starting a new one
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 125);
}

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

document.addEventListener("keydown", (event) => {
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
  // Only allow and play sound if not same and not opposite direction
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

function gameLoop() {
  snake.move(gridRows, gridCols);

  // Check self-collision
  if (snake.hasSelfCollision()) {
    if (score > highestScore) {
      highestScore = score;
      setHighestScore(highestScore);
    }
    // Play hit sound
    hitSound.currentTime = 0;
    hitSound.play();

    // Stop the game loop immediately
    if (gameInterval) clearInterval(gameInterval);

    const gameMainDiv = document.querySelector(".main_div");

    gameMainDiv.classList.add("shake");
    gameMainDiv.addEventListener(
      "animationend",
      () => {
        gameMainDiv.classList.remove("shake");
        setTimeout(() => {
          modal.classList.add("show");
        }, 300);
      },
      { once: true }
    );
    return;
  }

  // Check food collision
  if (snake.body[0].x === food.x && snake.body[0].y === food.y) {
    eatSound.currentTime = 0;
    eatSound.play();
    snake.grow(); // This should update the body to include the new head
    food = randomFoodPosition(gridRows, gridCols, snake.body); // Pass the updated body
    score++;
    updateScoreDisplay(score, highestScore);
  }

  render(playBoard, snake, food);
}

initializeGame();

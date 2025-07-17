// board.js
import { getDirection } from "./snake.js";

export function updateGridSize(playBoard, minCells = 10, maxCells = 18) {
  const size = Math.min(window.innerWidth, window.innerHeight);
  const cells = Math.max(minCells, Math.min(maxCells, Math.floor(size / 20)));
  if (playBoard) {
    playBoard.style.gridTemplateRows = `repeat(${cells}, 1fr)`;
    playBoard.style.gridTemplateColumns = `repeat(${cells}, 1fr)`;
  }
  return cells;
}

export function render(playBoard, snake, food) {
  playBoard.innerHTML = `<div class="foodcase" style="grid-area: ${food.y} / ${food.x}"></div>`;

  for (let i = 0; i < snake.body.length; i++) {
    let className = "snakecase";
    let style = `grid-area: ${snake.body[i].y} / ${snake.body[i].x};`;
    let segmentType = "";

    if (i === 0) {
      // HEAD
      className += " head";
      const next = snake.body[1];
      const headDir = getDirection(snake.body[0], next) || snake.direction;
      style += getRotationStyle(headDir);
    } else if (i === snake.body.length - 1) {
      // TAIL
      className += " tail";
      let tailDir = null;
      if (snake.body.length === 1) {
        tailDir = snake.direction;
      } else {
        const curr = snake.body[i];
        const prev = snake.body[i - 1];
        // If overlapped (after eating): look further up to infer movement
        if (curr.x === prev.x && curr.y === prev.y) {
          if (snake.body.length > 2) {
            // Use direction from 2nd-last to 3rd-last
            tailDir = getDirection(snake.body[i - 2], prev) || snake.direction;
          } else {
            // Only two parts, fallback to snake.direction
            tailDir = snake.direction;
          }
        } else {
          // Standard case
          tailDir = getDirection(prev, curr) || snake.direction;
        }
      }
      style += getRotationStyle(tailDir);
    } else {
      // BODY
      const prev = snake.body[i - 1];
      const next = snake.body[i + 1];
      const from = getDirection(snake.body[i], next);
      const to = getDirection(prev, snake.body[i]);

      console.log("from:", from, "to:", to);

      if (from && to && from === to) {
        if (from === "left" || from === "right") {
          className += " body horizontal";
        } else if (from === "up" || from === "down") {
          className += " body vertical";
        }
      } else if (from && to) {
        className += " body corner";
        style += getCornerRotationStyle(from, to);
      }
    }

    playBoard.innerHTML += `<div class="${className}" style="${style}"></div>`;
  }
}

// Helper function to get rotation for head/tail
function getRotationStyle(dir) {
  switch (dir) {
    case "up":
      return " transform: rotate(180deg);";
    case "down":
      return " transform: rotate(0deg);";
    case "left":
      return " transform: rotate(90deg);";
    case "right":
      return " transform: rotate(-90deg);";
    default:
      return "";
  }
}

function getCornerRotationStyle(from, to) {
  const lookup = {
    up_right: " transform: rotate(180deg);",
    right_up: " transform: rotate(0deg);",
    up_left: " transform: rotate(-90deg);",
    right_down: " transform: rotate(-90deg);",
    left_up: " transform: rotate(90deg);",
    left_down: " transform: rotate(180deg);",
    down_right: " transform: rotate(90deg);",
    down_left: " transform: rotate(0deg);",
  };
  return lookup[`${from}_${to}`] || "";
}

// snake.js
import { updateGridSize } from "./board.js";

// Utility: returns true if directions are opposites
export function isOpposite(dir1, dir2) {
  return (
    (dir1 === "up" && dir2 === "down") ||
    (dir1 === "down" && dir2 === "up") ||
    (dir1 === "left" && dir2 === "right") ||
    (dir1 === "right" && dir2 === "left")
  );
}

export class SnakeSegment {
  constructor(y, x) {
    this.y = y;
    this.x = x;
  }
}

export function getDirection(segA, segB) {
  let gridRows = 0,
    gridCols = 0;
  gridRows = gridCols = updateGridSize();

  if (!segA || !segB) return null;
  // Y-axis (vertical movement)
  if (segB.x === segA.x) {
    let dy = segB.y - segA.y;
    // Handle wrapping upwards
    if (dy === 1 || dy === -(gridRows - 1)) return "up";
    if (dy === -1 || dy === gridRows - 1) return "down";
  }
  // X-axis
  else if (segB.y === segA.y) {
    let dx = segB.x - segA.x;
    // Handle wrapping left
    if (dx === 1 || dx === -(gridCols - 1)) return "left";
    if (dx === -1 || dx === gridCols - 1) return "right";
  }
  return null;
}

export class Snake {
  constructor(startY, startX) {
    this.body = [new SnakeSegment(startY, startX)];
    this.direction = null;
    this.directionQueue = []; // NEW: Holds queued directions
  }

  setDirection(dir) {
    // Use last queued or current direction for logic
    const lastDir =
      this.directionQueue.length > 0
        ? this.directionQueue[this.directionQueue.length - 1]
        : this.direction;
    if (lastDir && isOpposite(lastDir, dir)) return; // Prevent U-turn
    if (lastDir === dir) return; // Prevent duplicate
    this.directionQueue.push(dir);
  }

  move(gridRows, gridCols) {
    if (!this.direction) return;
    let { y, x } = this.body[0];
    let newY = y,
      newX = x;

    switch (this.direction) {
      case "up":
        newY = y - 1 < 1 ? gridRows : y - 1;
        break;
      case "down":
        newY = y + 1 > gridRows ? 1 : y + 1;
        break;
      case "left":
        newX = x - 1 < 1 ? gridCols : x - 1;
        break;
      case "right":
        newX = x + 1 > gridCols ? 1 : x + 1;
        break;
    }

    // Move body
    for (let i = this.body.length - 1; i > 0; i--) {
      this.body[i].y = this.body[i - 1].y;
      this.body[i].x = this.body[i - 1].x;
    }
    this.body[0].y = newY;
    this.body[0].x = newX;
  }

  grow() {
    const last = this.body[this.body.length - 1];
    this.body.push(new SnakeSegment(last.y, last.x));
  }

  hasSelfCollision() {
    const [head, ...rest] = this.body;
    return rest.some((seg) => seg.x === head.x && seg.y === head.y);
  }
}

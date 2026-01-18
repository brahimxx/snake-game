// snake.js

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

export function getDirection(segA, segB, gridRows, gridCols) {
  if (!segA || !segB) return null;

  // Y-axis (vertical movement)
  if (segB.x === segA.x) {
    let dy = segB.y - segA.y;
    // Handle wrapping upwards
    if (dy === 1 || (gridRows && dy === -(gridRows - 1))) return "up";
    if (dy === -1 || (gridRows && dy === gridRows - 1)) return "down";
  }
  // X-axis
  else if (segB.y === segA.y) {
    let dx = segB.x - segA.x;
    // Handle wrapping left
    if (dx === 1 || (gridCols && dx === -(gridCols - 1))) return "left";
    if (dx === -1 || (gridCols && dx === gridCols - 1)) return "right";
  }
  return null;
}

export class Snake {
  constructor(startY, startX, gridRows, gridCols) {
    this.body = [new SnakeSegment(startY, startX)];
    this.direction = null;
    this.directionQueue = [];
    this.gridRows = gridRows;
    this.gridCols = gridCols;
    this.growPending = 0; // Track pending growth
  }

  setDirection(dir) {
    // Allow up to 2 queued directions for smooth multi-directional moves
    // But validate each against the previous to prevent passing through body
    const MAX_QUEUE_SIZE = 2;

    // Get the direction to check against (last in queue or current)
    const checkAgainst =
      this.directionQueue.length > 0
        ? this.directionQueue[this.directionQueue.length - 1]
        : this.direction;

    // Prevent opposite direction (would cause self-collision)
    if (checkAgainst && isOpposite(checkAgainst, dir)) return;

    // Prevent duplicate
    if (checkAgainst === dir) return;

    // Add to queue if not full
    if (this.directionQueue.length < MAX_QUEUE_SIZE) {
      this.directionQueue.push(dir);
    } else {
      // Queue full, replace last one (keeps the turn sequence valid)
      this.directionQueue[MAX_QUEUE_SIZE - 1] = dir;
    }
  }

  move() {
    if (!this.direction) return;
    let { y, x } = this.body[0];
    let newY = y;
    let newX = x;

    switch (this.direction) {
      case "up":
        newY = y - 1 < 1 ? this.gridRows : y - 1;
        break;
      case "down":
        newY = y + 1 > this.gridRows ? 1 : y + 1;
        break;
      case "left":
        newX = x - 1 < 1 ? this.gridCols : x - 1;
        break;
      case "right":
        newX = x + 1 > this.gridCols ? 1 : x + 1;
        break;
    }

    // Move body (if growing, don't remove tail)
    if (this.growPending > 0) {
      // Add new head, keep tail (growth)
      this.body.unshift(new SnakeSegment(newY, newX));
      this.growPending--;
    } else {
      // Normal move: shift all segments
      for (let i = this.body.length - 1; i > 0; i--) {
        this.body[i].y = this.body[i - 1].y;
        this.body[i].x = this.body[i - 1].x;
      }
      this.body[0].y = newY;
      this.body[0].x = newX;
    }
  }

  grow() {
    this.growPending++;
  }

  hasSelfCollision() {
    const [head, ...rest] = this.body;
    return rest.some((seg) => seg.x === head.x && seg.y === head.y);
  }

  updateGridSize(gridRows, gridCols) {
    this.gridRows = gridRows;
    this.gridCols = gridCols;
  }
}

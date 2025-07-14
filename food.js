export function randomFoodPosition(gridRows, gridCols, snakeBody) {
  const occupied = new Set(
    snakeBody.map((segment) => `${segment.x},${segment.y}`)
  );
  const freePositions = [];
  for (let x = 1; x <= gridCols; x++) {
    for (let y = 1; y <= gridRows; y++) {
      if (!occupied.has(`${x},${y}`)) {
        freePositions.push({ x, y });
      }
    }
  }
  if (freePositions.length === 0) return null;
  return freePositions[Math.floor(Math.random() * freePositions.length)];
}

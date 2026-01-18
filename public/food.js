export function randomFoodPosition(gridRows, gridCols, snakeBody) {
  const occupied = new Set(
    snakeBody.map((segment) => `${segment.x},${segment.y}`),
  );

  const maxAttempts = gridRows * gridCols;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const x = Math.floor(Math.random() * gridCols) + 1;
    const y = Math.floor(Math.random() * gridRows) + 1;

    if (!occupied.has(`${x},${y}`)) {
      return { x, y };
    }
    attempts++;
  }

  for (let x = 1; x <= gridCols; x++) {
    for (let y = 1; y <= gridRows; y++) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  return null; // Board is full
}

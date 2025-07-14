// board.js
export function updateGridSize(playBoard, minCells = 10, maxCells = 25) {
  const size = Math.min(window.innerWidth, window.innerHeight);
  const cells = Math.max(minCells, Math.min(maxCells, Math.floor(size / 20)));
  playBoard.style.gridTemplateRows = `repeat(${cells}, 1fr)`;
  playBoard.style.gridTemplateColumns = `repeat(${cells}, 1fr)`;
  return cells;
}

export function render(playBoard, snake, food) {
  playBoard.innerHTML = `<div class="foodcase" style="grid-area: ${food.y} / ${food.x}"></div>`;
  snake.body.forEach((segment) => {
    playBoard.innerHTML += `<div class="snakecase" style="grid-area: ${segment.y} / ${segment.x}"></div>`;
  });
}

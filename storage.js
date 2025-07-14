// storage.js
export function getHighestScore() {
  return Number(localStorage.getItem("highest_score")) || 0;
}

export function setHighestScore(score) {
  localStorage.setItem("highest_score", score);
}

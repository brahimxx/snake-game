// utils.js
export function updateScoreDisplay(currentScore, highestScore) {
  const currentScoreElement = document.querySelector(".current_score");
  const highestScoreElement = document.querySelector(".highest_score");

  currentScoreElement.textContent = "Score: " + currentScore;
  highestScoreElement.textContent = "High Score: " + highestScore;

  // Add a pulse animation when score changes
  currentScoreElement.style.animation = "none";
  setTimeout(() => {
    currentScoreElement.style.animation = "pulse 0.3s ease";
  }, 10);
}

// Add CSS for pulse animation via JavaScript
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); color: #70d98b; }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

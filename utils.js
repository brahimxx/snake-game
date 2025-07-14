// utils.js
export function updateScoreDisplay(currentScore, highestScore) {
  document.querySelector(".current_score").innerHTML =
    "Score : " + currentScore;
  document.querySelector(".highest_score").innerHTML =
    "Highest score : " + highestScore;
}

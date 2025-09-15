import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon gives you this URL
  ssl: { rejectUnauthorized: false }, // required for Neon
});

// Get highest score
export async function getHighestScore(difficulty = "normal") {
  try {
    const { rows } = await pool.query(
      "SELECT score FROM highscores WHERE difficulty = $1",
      [difficulty]
    );
    return rows[0]?.score || 0;
  } catch (err) {
    console.error("getHighestScore error:", err);
    return 0;
  }
}

// Set highest score
export async function setHighestScore(score, difficulty = "normal") {
  try {
    const { rows } = await pool.query(
      `INSERT INTO highscores (difficulty, score)
       VALUES ($1, $2)
       ON CONFLICT (difficulty)
       DO UPDATE SET score = GREATEST(highscores.score, EXCLUDED.score)
       RETURNING score`,
      [difficulty, score]
    );
    return rows[0].score === score; // true if it's a new highscore
  } catch (err) {
    console.error("setHighestScore error:", err);
    return false;
  }
}

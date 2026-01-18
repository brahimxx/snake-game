import mysql from "mysql2/promise";

// Create connection pool
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL, // MySQL connection string
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Get highest score
export async function getHighestScore(difficulty = "normal") {
  try {
    const [rows] = await pool.query(
      "SELECT score FROM highscores WHERE difficulty = ?",
      [difficulty],
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
    await pool.query(
      `INSERT INTO highscores (difficulty, score)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE score = GREATEST(score, VALUES(score))`,
      [difficulty, score],
    );
    // Check if it's the new high score
    const [rows] = await pool.query(
      "SELECT score FROM highscores WHERE difficulty = ?",
      [difficulty],
    );
    return rows[0]?.score === score;
  } catch (err) {
    console.error("setHighestScore error:", err);
    return false;
  }
}

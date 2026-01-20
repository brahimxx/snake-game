import mysql from "mysql2/promise";

// Parse the connection string to remove unsupported ssl-mode param
// which causes a warning in mysql2
let connectionUri = process.env.DATABASE_URL;
let sslConfig = {};

if (connectionUri) {
  try {
    const dbUrl = new URL(connectionUri);
    // If ssl-mode is present, likely we need SSL.
    // mysql2 expects 'ssl' object, not 'ssl-mode' string.
    if (dbUrl.searchParams.has("ssl-mode")) {
      dbUrl.searchParams.delete("ssl-mode");
      // Default to allowing unauthorized (self-signed) for broad compatibility
      // unless user specifically configures otherwise. 
      // For many cloud providers, just having 'ssl: {}' enables it.
      sslConfig = { rejectUnauthorized: false };
    }
    connectionUri = dbUrl.toString();
  } catch (e) {
    console.warn("Failed to parse DATABASE_URL:", e);
  }
}

// Create connection pool
const pool = mysql.createPool({
  uri: connectionUri, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslConfig,
});

// Get top 5 scores for a specific difficulty and device type
export async function getLeaderboard(
  difficulty = "normal",
  deviceType = "desktop",
) {
  try {
    const [rows] = await pool.query(
      `SELECT player_name, score, created_at 
       FROM leaderboard 
       WHERE difficulty = ? AND device_type = ?
       ORDER BY score DESC 
       LIMIT 5`,
      [difficulty, deviceType],
    );
    return rows;
  } catch (err) {
    console.error("getLeaderboard error:", err);
    return [];
  }
}

// Submit a new score
export async function submitScore(
  name,
  score,
  difficulty = "normal",
  deviceType = "desktop",
) {
  try {
    // Insert new score
    await pool.query(
      "INSERT INTO leaderboard (player_name, score, difficulty, device_type) VALUES (?, ?, ?, ?)",
      [name, score, difficulty, deviceType],
    );

    // Cleanup: Keep only top 5 per category
    // We delete any record for this category that is NOT in the top 5.
    // Using a subquery to identify the IDs to keep.
    await pool.query(
      `DELETE FROM leaderboard 
       WHERE difficulty = ? AND device_type = ? 
       AND id NOT IN (
         SELECT id FROM (
           SELECT id 
           FROM leaderboard 
           WHERE difficulty = ? AND device_type = ? 
           ORDER BY score DESC, created_at ASC 
           LIMIT 5
         ) AS keep_ids
       )`,
      [difficulty, deviceType, difficulty, deviceType],
    );

    return true;
  } catch (err) {
    console.error("submitScore error:", err);
    return false;
  }
}

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mysql = require("mysql2/promise");

// Database connection configuration
let pool;

try {
  if (process.env.DATABASE_URL) {
    // Parse DigitalOcean connection string properly
    const dbUrl = new URL(process.env.DATABASE_URL);

    pool = mysql.createPool({
      host: dbUrl.hostname,
      port: dbUrl.port || 25060,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1), // Remove leading slash
      waitForConnections: true,
      connectionLimit: 3, // Lower for DigitalOcean basic
      queueLimit: 0,
      idleTimeout: 60000, // Close idle connections after 60 seconds
      acquireTimeout: 15000, // 15 second timeout to get connection
      ssl: {
        rejectUnauthorized: false, // Required for DigitalOcean
      },
    });
  } else {
    pool = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "",
      database: "snake_game",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
} catch (error) {
  console.error("❌ Failed to create database pool:", error);
  pool = null;
}

export async function getLeaderboard(
  difficulty = "normal",
  deviceType = "desktop",
) {
  if (!pool) {
    return getMockLeaderboard(difficulty, deviceType);
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [results] = await connection.execute(
      `SELECT id, player_name as name, score, created_at 
       FROM leaderboard 
       WHERE difficulty = ? AND device_type = ? 
       ORDER BY score DESC, created_at ASC 
       LIMIT 5`,
      [difficulty, deviceType],
    );

    return results;
  } catch (err) {
    console.error("❌ Database query failed:", err);
    console.log("🔄 Falling back to mock data");
    return getMockLeaderboard(difficulty, deviceType);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export async function submitScore(
  name,
  score,
  difficulty = "normal",
  deviceType = "desktop",
) {
  if (!pool) {
    return submitMockScore(name, score, difficulty, deviceType);
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Insert the new score
    await connection.execute(
      `INSERT INTO leaderboard (player_name, score, difficulty, device_type, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [name, score, difficulty, deviceType],
    );

    // Clean up excess records (keep only top 5)
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM leaderboard WHERE difficulty = ? AND device_type = ?`,
      [difficulty, deviceType],
    );

    if (countResult[0].total > 5) {
      await connection.execute(
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
    }

    return true;
  } catch (err) {
    return submitMockScore(name, score, difficulty, deviceType);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Fallback mock data functions
function getMockLeaderboard(difficulty, deviceType) {
  const mockLeaderboards = {
    easy_desktop: [
      {
        id: 1,
        name: "Alice",
        score: 150,
        created_at: new Date("2026-01-20T10:00:00Z"),
      },
      {
        id: 2,
        name: "Bob",
        score: 120,
        created_at: new Date("2026-01-20T11:00:00Z"),
      },
      {
        id: 3,
        name: "Charlie",
        score: 100,
        created_at: new Date("2026-01-20T12:00:00Z"),
      },
    ],
    normal_desktop: [
      {
        id: 1,
        name: "David",
        score: 200,
        created_at: new Date("2026-01-20T10:00:00Z"),
      },
      {
        id: 2,
        name: "Eve",
        score: 180,
        created_at: new Date("2026-01-20T11:00:00Z"),
      },
    ],
    hard_desktop: [
      {
        id: 1,
        name: "Frank",
        score: 250,
        created_at: new Date("2026-01-20T10:00:00Z"),
      },
    ],
  };

  const key = `${difficulty}_${deviceType}`;
  return mockLeaderboards[key] || [];
}

let mockStore = {};
function submitMockScore(name, score, difficulty, deviceType) {
  const key = `${difficulty}_${deviceType}`;
  if (!mockStore[key]) {
    mockStore[key] = getMockLeaderboard(difficulty, deviceType);
  }

  const newEntry = {
    id: Date.now(),
    name,
    score,
    created_at: new Date(),
  };

  mockStore[key].push(newEntry);
  mockStore[key].sort((a, b) => b.score - a.score);
  mockStore[key] = mockStore[key].slice(0, 5);

  return true;
}

export async function testDatabaseConnection() {
  if (!pool) {
    return {
      success: false,
      message: "Database pool not initialized",
      fallback: "Using mock data",
    };
  }

  let connection;
  try {
    const startTime = Date.now();

    connection = await pool.getConnection();
    const connectionTime = Date.now() - startTime;

    const queryStart = Date.now();
    await connection.execute("SELECT 1 as test");
    const queryTime = Date.now() - queryStart;

    return {
      success: true,
      connectionTime: `${connectionTime}ms`,
      queryTime: `${queryTime}ms`,
      totalTime: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallback: "Using mock data",
    };
  } finally {
    if (connection) connection.release();
  }
}

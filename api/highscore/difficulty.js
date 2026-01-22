import { getLeaderboard, submitScore } from "../../db-wrapper.js";

export default async function handler(req, res) {
  // Set timeout for slow database connections
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Database request timeout" });
    }
  }, 5000); // 5 second timeout

  try {
    const { difficulty = "normal", deviceType = "desktop" } = req.query;

    if (req.method === "GET") {
      const leaderboard = await getLeaderboard(difficulty, deviceType);

      clearTimeout(timeoutId);
      res.status(200).json({ difficulty, deviceType, leaderboard });
      return;
    }

    if (req.method === "POST") {
      const { score, name, deviceType: bodyDeviceType } = req.body;
      const targetDevice = bodyDeviceType || deviceType;

      const success = await submitScore(
        name || "Anonymous",
        Number(score),
        difficulty,
        targetDevice,
      );

      if (success) {
        const newLeaderboard = await getLeaderboard(difficulty, targetDevice);
        clearTimeout(timeoutId);
        res.status(200).json({ success: true, leaderboard: newLeaderboard });
      } else {
        clearTimeout(timeoutId);
        res.status(500).json({ error: "Failed to submit score" });
      }
      return;
    }

    clearTimeout(timeoutId);
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    clearTimeout(timeoutId);
    console.error("API error:", e);
    res.status(500).json({ error: String(e) });
  }
}

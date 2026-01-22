import { getLeaderboard, submitScore } from "../../storage.js";

export default async function handler(req, res) {
  // Set timeout for slow database connections
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Database request timeout" });
    }
  }, 2000); // 2 second timeout

  try {
    const { difficulty = "normal", deviceType = "desktop" } = req.query;

    if (req.method === "GET") {
      console.log(`API: Fetching leaderboard for ${difficulty}/${deviceType}`);
      const startTime = Date.now();

      const leaderboard = await getLeaderboard(difficulty, deviceType);

      const endTime = Date.now();
      console.log(
        `API: Leaderboard query completed in ${endTime - startTime}ms`,
      );

      clearTimeout(timeoutId);
      res.status(200).json({ difficulty, deviceType, leaderboard });
      return;
    }

    if (req.method === "POST") {
      const { score, name, deviceType: bodyDeviceType } = req.body;
      const targetDevice = bodyDeviceType || deviceType;

      await submitScore(
        name || "Anonymous",
        Number(score),
        difficulty,
        targetDevice,
      );

      const newLeaderboard = await getLeaderboard(difficulty, targetDevice);
      clearTimeout(timeoutId);
      res.status(200).json({ success: true, leaderboard: newLeaderboard });
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

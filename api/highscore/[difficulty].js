import { getLeaderboard, submitScore } from "../../storage.js";

export default async function handler(req, res) {
  try {
    const { difficulty = "normal", deviceType = "desktop" } = req.query;

    if (req.method === "GET") {
      const leaderboard = await getLeaderboard(difficulty, deviceType);
      res.status(200).json({ difficulty, deviceType, leaderboard });
      return;
    }

    if (req.method === "POST") {
      const { score, name, deviceType: bodyDeviceType } = req.body;
      const targetDevice = bodyDeviceType || deviceType;
      
      await submitScore(name || "Anonymous", Number(score), difficulty, targetDevice);
      
      const newLeaderboard = await getLeaderboard(difficulty, targetDevice);
      res.status(200).json({ success: true, leaderboard: newLeaderboard });
      return;
    }
    
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error("API error:", e);
    res.status(500).json({ error: String(e) });
  }
}

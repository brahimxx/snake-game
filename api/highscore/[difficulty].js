import { getHighestScore, setHighestScore } from "../../../storage.js";

export default async function handler(req, res) {
  try {
    const { difficulty = "normal" } = req.query;

    if (req.method === "GET") {
      const score = await getHighestScore(difficulty);
      res.status(200).json({ difficulty, score });
      return;
    }
    if (req.method === "POST") {
      const { score } = req.body;
      const updated = await setHighestScore(Number(score), difficulty);
      const newHighScore = await getHighestScore(difficulty);
      res.status(200).json({ success: updated, newHighScore });
      return;
    }
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error("API error:", e);
    res.status(500).json({ error: String(e) });
  }
}

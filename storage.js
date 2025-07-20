// storage.js (in project root)
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // Uses Upstash/Vercel env vars

export async function getHighestScore(difficulty = "normal") {
  const key = `highscore:${difficulty}`;
  const score = await redis.get(key);
  return Number(score) || 0;
}

export async function setHighestScore(score, difficulty = "normal") {
  const key = `highscore:${difficulty}`;
  const current = Number(await redis.get(key)) || 0;
  if (score > current) {
    await redis.set(key, score);
    return true;
  }
  return false;
}

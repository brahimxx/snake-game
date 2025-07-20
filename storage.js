import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });

client.on("error", (err) => {
  console.error("Redis client error:", err);
});

let connection;
async function getClient() {
  if (!connection) {
    connection = client.connect().then(() => client);
  }
  return connection;
}

export async function getHighestScore(difficulty = "normal") {
  const cli = await getClient();
  const key = `highscore:${difficulty}`;
  const score = await cli.get(key);
  return Number(score) || 0;
}

export async function setHighestScore(score, difficulty = "normal") {
  const cli = await getClient();
  const key = `highscore:${difficulty}`;
  const current = Number(await cli.get(key)) || 0;
  if (score > current) {
    await cli.set(key, score);
    return true;
  }
  return false;
}

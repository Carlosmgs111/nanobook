import { createClient, type RedisClientType } from "redis";
import { REDIS_URL } from "astro:env/server";

let client: RedisClientType | null = null;

export function getRedisClient(url?: string): RedisClientType {
  if (client) return client;

  const redisUrl = url ?? REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined");
  }

  client = createClient({ url: redisUrl }) as RedisClientType;

  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  return client;
}

export async function withRedisClient<T>(
  operation: (client: RedisClientType) => Promise<T>,
): Promise<T | null> {
  try {
    const redis = getRedisClient();
    if (!redis.isOpen) {
      await redis.connect();
    }
    return await operation(redis);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Redis operation failed: ${message}`);
    return null;
  }
}

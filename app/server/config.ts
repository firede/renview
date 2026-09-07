export interface AppConfig {
  origin: string;
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  databasePath: string;
  redisUrl: string;
}
export function readConfig(): AppConfig {
  const required = (key: string) => {
    const value = process.env[key];
    if (!value) throw new Error(`缺少配置 ${key}`);
    return value;
  };
  const origin = new URL(required("APP_ORIGIN"));
  if (
    origin.protocol !== "https:" &&
    !(origin.protocol === "http:" && origin.hostname === "localhost")
  )
    throw new Error("APP_ORIGIN 必须使用 HTTPS，localhost 开发环境除外");
  const encryptionKey = required("AUTH_ENCRYPTION_KEY");
  if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey))
    throw new Error("AUTH_ENCRYPTION_KEY 必须是 32 字节的十六进制密钥");
  return {
    origin: origin.origin,
    clientId: required("GITHUB_CLIENT_ID"),
    clientSecret: required("GITHUB_CLIENT_SECRET"),
    encryptionKey,
    databasePath: process.env.DATABASE_PATH ?? "./data/auth.sqlite",
    redisUrl: required("REDIS_URL"),
  };
}

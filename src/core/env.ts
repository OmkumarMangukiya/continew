import "dotenv/config";

function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === "") {
        throw new Error(`[FATAL] Missing required environment variable: ${key}. Application cannot start.`);
    }
    return value;
}

export const JWT_SECRET = getRequiredEnv("JWT_SECRET");
export const DATABASE_URL = getRequiredEnv("DATABASE_URL");

export const env = {
    JWT_SECRET,
    DATABASE_URL
};
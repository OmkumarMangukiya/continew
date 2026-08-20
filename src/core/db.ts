import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const isCloudDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

export const db = new Pool({
    connectionString:
        process.env.DATABASE_URL ||
        `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'continew'}`,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false
});

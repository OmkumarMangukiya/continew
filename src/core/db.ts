import pg from "pg";
import { DATABASE_URL } from "./env.js";

const { Pool } = pg;
const isCloudDb = DATABASE_URL.includes('sslmode=require') || (!DATABASE_URL.includes('localhost') && !DATABASE_URL.includes('postgres'));

export const db = new Pool({
    connectionString: DATABASE_URL,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false
});
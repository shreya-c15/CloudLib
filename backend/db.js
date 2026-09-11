const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

console.log("Database host:", new URL(connectionString).hostname);

const pool = new Pool({
    connectionString: connectionString
});

module.exports = pool;
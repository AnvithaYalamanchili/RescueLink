const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST, // e.g., localhost
  user: process.env.DB_USER, // your postgres username
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // e.g., rescue_link
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;
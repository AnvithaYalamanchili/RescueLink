const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/volunteers
router.post("/", async (req, res) => {
  try {
    const { name, phone, skills, zone } = req.body;

    const result = await pool.query(
      `INSERT INTO volunteers(name, phone, skills, zone)
       VALUES($1, $2, $3, $4) RETURNING *`,
      [name, phone, skills, zone]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("VOLUNTEER REG ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/", async (req, res) => {
  try {
    const { name, type_of_relief, capacity, lat, lng, address, contact_number } = req.body;

    const result = await pool.query(
      `INSERT INTO relief_providers
       (name, type_of_relief, capacity, lat, lng, address, contact_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, type_of_relief, capacity, lat, lng, address, contact_number]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;

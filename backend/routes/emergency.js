const express=require("express");
const router=express.Router();
const pool=require("../db");

router.post('/', async (req, res) => {
  try {
    const {
      guest_id,
      emergency_type,
      description,
      people_count,
      contact_number,
      can_call,
      lat,
      lng,
      address,
    } = req.body;

    // 1️⃣ Insert the emergency request
    const result = await pool.query(
      `INSERT INTO emergency_requests(
          guest_id,
          emergency_type,
          description,
          people_count,
          contact_number,
          can_call,
          lat,
          lng,
          address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [guest_id, emergency_type, description, people_count, contact_number, can_call, lat, lng, address]
    );

    const request = result.rows[0];

    // 2️⃣ Assign volunteers immediately
    const volunteersNeeded = Math.ceil((request.people_count || 1) / 10);

    const volunteersResult = await pool.query(
      `SELECT * FROM volunteers WHERE available = TRUE LIMIT $1`,
      [volunteersNeeded]
    );

    const volunteers = volunteersResult.rows;

    for (let volunteer of volunteers) {
      await pool.query(
        `INSERT INTO request_assignments (request_id, volunteer_id, status, people_served)
         VALUES ($1, $2, 'assigned', 0)`,
        [request.id, volunteer.id]
      );

      await pool.query(`UPDATE volunteers SET available = FALSE WHERE id = $1`, [volunteer.id]);
    }

    if (volunteers.length > 0) {
      await pool.query(`UPDATE emergency_requests SET status = 'assigned' WHERE id = $1`, [request.id]);
    }

    // 3️⃣ Send the created request back
    res.json(request);

  } catch (err) {
    console.error("EMERGENCY CREATE ERROR:", err);
    res.status(500).send("Server error");
  }
});

// 📊 Get emergency request status
router.get("/:requestId/status", async (req, res) => {
  try {
    const { requestId } = req.params;

    // 1️⃣ Get request info
    const requestResult = await pool.query(
      `SELECT * FROM emergency_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const request = requestResult.rows[0];

    // 2️⃣ Get volunteer assignments
    const assignmentsResult = await pool.query(
      `SELECT 
          ra.id,
          ra.status,
          ra.people_served,
          v.name AS volunteer_name
       FROM request_assignments ra
       JOIN volunteers v ON v.id = ra.volunteer_id
       WHERE ra.request_id = $1`,
      [requestId]
    );

    const assignments = assignmentsResult.rows;

    // 3️⃣ Calculate progress
    const totalPeople = request.people_count || 1;

    const servedResult = await pool.query(
      `SELECT COALESCE(SUM(people_served), 0) AS total_served
       FROM request_assignments
       WHERE request_id = $1`,
      [requestId]
    );

    const totalServed = servedResult.rows[0].total_served;
    const progress = Math.min(100, Math.round((totalServed / totalPeople) * 100));

    res.json({
      request,
      assignments,
      progress
    });

  } catch (err) {
    console.error("STATUS FETCH ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports=router;
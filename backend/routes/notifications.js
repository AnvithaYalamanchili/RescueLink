const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/notifications/volunteer/:volunteerId - Get volunteer notifications
router.get("/volunteer/:volunteerId", async (req, res) => {
  let client;
  try {
    const { volunteerId } = req.params;
    
    // Get token from header for verification
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access token required" 
      });
    }

    client = await pool.connect();
    
    // Verify the volunteer ID matches the token
    // (In production, you should verify JWT and check if it matches volunteerId)
    
    const result = await client.query(
      `SELECT n.*, 
              er.emergency_type,
              er.severity,
              er.address as request_location
       FROM notifications n
       LEFT JOIN emergency_requests er ON n.request_id = er.id
       WHERE n.user_id = $1 
         AND n.user_type = 'volunteer'
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [volunteerId]
    );

    console.log(`📊 Found ${result.rows.length} notifications for volunteer ${volunteerId}`);
    
    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch notifications" 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put("/:id/read", async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { volunteerId } = req.body;

    client = await pool.connect();
    
    const result = await client.query(
      `UPDATE notifications 
       SET status = 'read', updated_at = NOW()
       WHERE id = $1 
         AND user_id = $2
         AND user_type = 'volunteer'
       RETURNING *`,
      [id, volunteerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Notification not found" 
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("MARK READ ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to update notification" 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
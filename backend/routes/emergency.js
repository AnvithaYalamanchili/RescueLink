const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/emergency - Create new emergency request
// POST /api/emergency - Create new emergency request
// POST /api/emergency - Create new emergency request
router.post("/", async (req, res) => {
  let client;
  try {
    const {
      emergency_type,
      description,
      people_count,
      contact_number,
      can_call,
      address,
      severity
    } = req.body;

    console.log("📝 Emergency submission received:", {
      emergency_type,
      address,
      severity,
      people_count
    });

    if (!emergency_type || !description || !contact_number) {
      return res.status(400).json({ 
        success: false,
        message: "Emergency type, description, and contact number are required" 
      });
    }

    if (contact_number.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide a valid phone number with at least 10 digits" 
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Create or find guest user
    let guestId;
    const guestPhone = contact_number.replace(/\D/g, '');
    
    console.log("📱 Guest phone:", guestPhone);
    
    const userCheck = await client.query(
      "SELECT id FROM users WHERE phone = $1",
      [guestPhone]
    );
    
    if (userCheck.rows.length > 0) {
      guestId = userCheck.rows[0].id;
      console.log("👤 Found existing user ID:", guestId);
    } else {
      const guestResult = await client.query(
        `INSERT INTO users (phone, role, name, email, created_at)
         VALUES ($1, 'guest', 'Guest User', $2, NOW())
         RETURNING id`,
        [guestPhone, `guest_${Date.now()}@example.com`]
      );
      guestId = guestResult.rows[0].id;
      console.log("👤 Created new guest user ID:", guestId);
    }

    // Determine severity
    let finalSeverity = severity || 'medium';
    if (!severity) {
      const highSeverityTypes = ['medical', 'fire', 'accident'];
      const mediumSeverityTypes = ['flood', 'earthquake'];
      if (highSeverityTypes.includes(emergency_type)) finalSeverity = 'high';
      else if (mediumSeverityTypes.includes(emergency_type)) finalSeverity = 'medium';
      else finalSeverity = 'low';
    }

    console.log("🔴 Final severity:", finalSeverity);

    // IMPROVED: Extract city/zone from address
    let requestZone = null;
    if (address) {
      // Clean and parse the address
      const cleanAddress = address.trim();
      
      // Try to extract city name (common patterns)
      // Pattern 1: Look for city after street address (e.g., "4700 taft blvd Wichita falls")
      const cityPatterns = [
        /\b(Wichita\s+Falls)\b/i,  // Wichita Falls
        /\b(San\s+Francisco)\b/i,  // San Francisco
        /\b(New\s+York)\b/i,       // New York
        /\b(Los\s+Angeles)\b/i,    // Los Angeles
        /,\s*([^,]+?)(?:\s+\d{5})?$/i,  // Last part before ZIP
      ];
      
      for (const pattern of cityPatterns) {
        const match = cleanAddress.match(pattern);
        if (match) {
          requestZone = match[1] || match[0];
          break;
        }
      }
      
      // If no pattern matched, take the last word as fallback
      if (!requestZone) {
        const words = cleanAddress.split(/\s+/);
        if (words.length > 1) {
          requestZone = words[words.length - 2] + ' ' + words[words.length - 1];
        } else {
          requestZone = cleanAddress;
        }
      }
      
      // Clean up the zone name
      requestZone = requestZone.trim();
      console.log("📍 Extracted zone from address:", requestZone);
    }

    // Insert emergency request
    const result = await client.query(
      `INSERT INTO emergency_requests (
        guest_id, emergency_type, description, people_count,
        contact_number, can_call, address, severity, status, created_at, address_zone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), $9)
      RETURNING *`,
      [
        guestId,
        emergency_type,
        description.trim(),
        parseInt(people_count) || 1,
        guestPhone,
        can_call || false,
        address ? address.trim() : null,
        finalSeverity,
        requestZone
      ]
    );

    const newRequest = result.rows[0];
    console.log("✅ Emergency request created with ID:", newRequest.id);

    // Calculate volunteers needed
    const volunteersNeeded = Math.max(1, Math.ceil(newRequest.people_count / 5));
    console.log("👥 Volunteers needed:", volunteersNeeded);

    // Find available volunteers
    let nearbyVolunteers = [];
    
    if (requestZone) {
      console.log("🔍 Searching for volunteers in zone:", requestZone);
      
      // SIMPLIFIED: Just get all available active volunteers
      const volunteersResult = await client.query(
        `SELECT id, name, phone, email, zone, skills, available, account_status
         FROM volunteers
         WHERE account_status = 'active'
           AND available = TRUE
         ORDER BY 
           CASE 
             WHEN zone IS NULL THEN 2
             WHEN zone ILIKE $1 THEN 1  -- Exact match
             ELSE 2
           END,
           last_active DESC
         LIMIT $2`,
        [`%${requestZone}%`, volunteersNeeded * 3]
      );
      
      nearbyVolunteers = volunteersResult.rows;
      console.log(`🔍 Found ${nearbyVolunteers.length} available volunteers total`);
      
      if (nearbyVolunteers.length > 0) {
        console.log("Volunteers found:");
        nearbyVolunteers.forEach((v, i) => {
          console.log(`  ${i + 1}. ${v.name} (ID: ${v.id}, Zone: ${v.zone}, Available: ${v.available})`);
        });
      }
    } else {
      // If no zone specified, get any available volunteers
      console.log("🌍 No zone specified, searching all available volunteers...");
      
      const allVolunteersResult = await client.query(
        `SELECT id, name, phone, email, zone, skills
         FROM volunteers
         WHERE account_status = 'active'
           AND available = TRUE
         ORDER BY last_active DESC
         LIMIT $1`,
        [volunteersNeeded * 3]
      );
      
      nearbyVolunteers = allVolunteersResult.rows;
      console.log(`🔍 Found ${nearbyVolunteers.length} total available volunteers`);
    }

    // Create notifications for volunteers
    console.log(`📢 Creating notifications for ${nearbyVolunteers.length} volunteers...`);
    
    for (const volunteer of nearbyVolunteers) {
      console.log(`   → Notifying volunteer ${volunteer.name} (ID: ${volunteer.id}, Zone: ${volunteer.zone})`);
      
      await client.query(
        `INSERT INTO notifications (
          user_id, user_type, request_id, message, notification_type, status, created_at
        ) VALUES ($1, 'volunteer', $2, $3, 'alert', 'unread', NOW())`,
        [
          volunteer.id,
          newRequest.id,
          `🚨 NEW ${emergency_type.toUpperCase()} EMERGENCY in ${requestZone || 'your area'}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''} - ${people_count} people affected. Click to accept.`
        ]
      );
    }

    await client.query('COMMIT');

    console.log("✅ Emergency request completed successfully");
    
    res.status(201).json({
      success: true,
      message: `Emergency request submitted successfully. ${nearbyVolunteers.length} volunteer(s) notified.`,
      data: {
        requestId: newRequest.id,
        totalNearbyVolunteers: nearbyVolunteers.length,
        volunteersNeeded: volunteersNeeded,
        zone: requestZone
      }
    });

  } catch (err) {
    console.error("❌ EMERGENCY REQUEST ERROR:", err);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to submit emergency request. Please try again.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseErr) {
        console.error("Client release error:", releaseErr);
      }
    }
  }
});
// GET /api/emergency/:id - Get emergency request status
router.get("/:id", async (req, res) => {
  let client;
  try {
    const { id } = req.params;

    client = await pool.connect();
    
    const result = await client.query(
      `SELECT er.*, 
              ra.status as assignment_status,
              ra.assigned_at,
              ra.started_at,
              ra.completed_at,
              v.name as volunteer_name,
              v.phone as volunteer_phone
       FROM emergency_requests er
       LEFT JOIN request_assignments ra ON er.id = ra.request_id
       LEFT JOIN volunteers v ON ra.volunteer_id = v.id
       WHERE er.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Emergency request not found" 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("GET EMERGENCY ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch emergency request" 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/emergency/status/:id - Simplified status for public view
router.get("/status/:id", async (req, res) => {
  let client;
  try {
    const { id } = req.params;

    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        id,
        emergency_type,
        description,
        people_count,
        contact_number,
        address,
        severity,
        status,
        created_at,
        (
          SELECT COUNT(*) 
          FROM request_assignments 
          WHERE request_id = emergency_requests.id 
          AND status IN ('assigned', 'in_progress')
        ) as volunteers_assigned,
        (
          SELECT COUNT(*) 
          FROM request_assignments 
          WHERE request_id = emergency_requests.id 
          AND status = 'completed'
        ) as volunteers_completed
       FROM emergency_requests 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Emergency request not found" 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("GET STATUS ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch status" 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
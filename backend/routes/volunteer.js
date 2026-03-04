const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require('jsonwebtoken'); 
const authMiddleware = require('../middleware/auth'); 

router.post("/", async (req, res) => {
  let client;
  try {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      zone,
      address,
      skills,
      experience,
      experience_years,
      availability,
      agreed_to_terms
    } = req.body;

    console.log("Registration attempt:", { email, name });

    if (!name || !email || !phone || !password || !zone) {
      return res.status(400).json({ 
        success: false,
        message: "Name, email, phone, password, and zone are required" 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Passwords do not match" 
      });
    }

    if (!agreed_to_terms) {
      return res.status(400).json({ 
        success: false,
        message: "You must agree to the terms and conditions" 
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const emailCheck = await client.query(
      "SELECT id FROM volunteers WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false,
        message: "Email already registered" 
      });
    }

    const phoneCheck = await client.query(
      "SELECT id FROM volunteers WHERE phone = $1",
      [phone.replace(/\D/g, '')]
    );

    if (phoneCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false,
        message: "Phone number already registered" 
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const verificationToken = crypto.randomBytes(32).toString('hex');

    let skillsArray = [];
    if (skills) {
      if (typeof skills === 'string') {
        skillsArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
      } else if (Array.isArray(skills)) {
        skillsArray = skills;
      }
    }

    let finalExperienceYears = experience_years;
    if (!finalExperienceYears && experience) {
      const yearsMatch = experience.match(/\d+/);
      if (yearsMatch) {
        finalExperienceYears = parseInt(yearsMatch[0]);
      }
    }

    let experienceLevel = experience;
    if (experience) {
      const expMap = {
        'Beginner': 'beginner',
        'Intermediate': 'intermediate',
        'Experienced': 'experienced',
        'Expert': 'expert'
      };
      experienceLevel = expMap[experience] || experience.toLowerCase();
    }

    const finalAvailability = availability || 'Part-time';

    const result = await client.query(
      `INSERT INTO volunteers (
        name, email, phone, password_hash, zone, address,
        skills, experience_level, experience_years, availability,
        agreed_to_terms, terms_agreed_at, verification_token,
        account_status, email_verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, 'active', TRUE, NOW())
      RETURNING id, name, email, phone, zone, availability, account_status, email_verified, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone.replace(/\D/g, ''),
        passwordHash,
        zone.trim(),
        address ? address.trim() : null,
        skillsArray.length > 0 ? skillsArray : null,
        experienceLevel,
        finalExperienceYears,
        finalAvailability,
        agreed_to_terms,
        verificationToken
      ]
    );

    const newVolunteer = result.rows[0];

    try {
      await client.query(
        `INSERT INTO users (name, phone, email, role, created_at)
         VALUES ($1, $2, $3, 'volunteer', NOW())`,
        [name.trim(), phone.replace(/\D/g, ''), email.trim().toLowerCase()]
      );
    } catch (err) {
      console.log("Note: Could not create user record:", err.message);
    }

    await client.query('COMMIT');

    console.log("Registration successful for:", email);
    
    const token = jwt.sign(
      { 
        id: newVolunteer.id, 
        email: newVolunteer.email, 
        role: 'volunteer',
        name: newVolunteer.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful! You can now login.",
      data: {
        id: newVolunteer.id,
        name: newVolunteer.name,
        email: newVolunteer.email,
        phone: newVolunteer.phone,
        zone: newVolunteer.zone,
        status: newVolunteer.account_status,
        token: token 
      }
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    console.error("VOLUNTEER REGISTRATION ERROR:", err);
    
    if (err.code === '23505') { 
      const field = err.constraint?.includes('email') ? 'email' : 'phone';
      return res.status(409).json({ 
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already registered` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Registration failed. Please try again later." 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    console.log('Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, phone, password_hash, zone, address,
              skills, experience_level, experience_years, availability,
              account_status, email_verified, available, last_active,
              total_assignments, completed_assignments, total_people_served,
              total_hours_volunteered, rating, profile_completed, created_at
       FROM volunteers WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log('No volunteer found with email:', email);
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const volunteer = result.rows[0];
    console.log('Volunteer found:', volunteer.email, 'Status:', volunteer.account_status);

    // if (volunteer.account_status !== 'active') {
    //   return res.status(403).json({ 
    //     success: false,
    //     message: "Account is not active. Please verify your email or contact support." 
    //   });
    // }

    const isValidPassword = await bcrypt.compare(password, volunteer.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // if (!volunteer.email_verified) {
    //   return res.status(403).json({ 
    //     success: false,
    //     message: "Please verify your email before logging in." 
    //   });
    // }

    await pool.query(
      "UPDATE volunteers SET last_login = NOW(), last_active = NOW() WHERE id = $1",
      [volunteer.id]
    );

    const token = jwt.sign(
  { 
    id: volunteer.id,
    email: volunteer.email,
    role: 'volunteer',
    name: volunteer.name
  },
  process.env.JWT_SECRET,
  { expiresIn: rememberMe ? '30d' : '1d' }
);

    delete volunteer.password_hash;

    console.log('Login successful for:', volunteer.email);
    
    res.json({
      success: true,
      message: "Login successful",
      data: {
        token: token,
        volunteer: volunteer
      }
    });

  } catch (err) {
    console.error("VOLUNTEER LOGIN ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Login failed. Please try again later." 
    });
  }
});

router.post("/accept", async (req, res) => {
  const { volunteer_id, request_id } = req.body;

  if (!volunteer_id || !request_id) {
    return res.status(400).json({
      success: false,
      message: "volunteer_id and request_id are required"
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const volunteerCheck = await client.query(
      `SELECT id, available 
       FROM volunteers 
       WHERE id = $1 AND account_status = 'active'`,
      [volunteer_id]
    );

    if (volunteerCheck.rows.length === 0 || !volunteerCheck.rows[0].available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "Volunteer not found or not available"
      });
    }

    const requestResult = await client.query(
      `SELECT id, people_count 
       FROM emergency_requests 
       WHERE id = $1`,
      [request_id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Emergency request not found"
      });
    }

    const emergencyRequest = requestResult.rows[0];
    const maxVolunteers = Math.ceil(emergencyRequest.people_count / 5);

    const assignedResult = await client.query(
      `SELECT COUNT(*) 
       FROM request_assignments 
       WHERE request_id = $1`,
      [request_id]
    );

    const assignedCount = parseInt(assignedResult.rows[0].count);

    if (assignedCount >= maxVolunteers) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "Maximum number of volunteers already assigned for this request"
      });
    }

    const alreadyAssigned = await client.query(
      `SELECT id FROM request_assignments 
       WHERE request_id = $1 AND volunteer_id = $2`,
      [request_id, volunteer_id]
    );

    if (alreadyAssigned.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "You have already accepted this request"
      });
    }

    await client.query(
      `INSERT INTO request_assignments (volunteer_id, request_id, status, assigned_at)
       VALUES ($1, $2, 'assigned', NOW())`,
      [volunteer_id, request_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "You have successfully accepted the emergency request",
      remainingSlots: maxVolunteers - assignedCount - 1
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("VOLUNTEER ACCEPT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to accept the request. Try again later.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});


router.get("/available-requests",authMiddleware, async (req, res) => {
  let client;
  try {
    
    const volunteer_id = req.user.id;

    client = await pool.connect();

    const volunteerResult = await client.query(
      `SELECT id, name, zone, skills, available 
       FROM volunteers 
       WHERE id = $1 AND account_status = 'active'`,
      [volunteer_id]
    );

    if (volunteerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Volunteer not found or inactive" });
    }

    const volunteer = volunteerResult.rows[0];
    
    console.log(`🔍 Fetching available requests for volunteer: ${volunteer.name} (Zone: ${volunteer.zone})`);

    if (!volunteer.available) {
      console.log("⏸️ Volunteer is marked as unavailable");
      return res.json({ 
        success: true, 
        data: [], 
        message: "You are currently marked as unavailable. Change your status to receive requests." 
      });
    }

    let query = `
      SELECT 
        er.*,
        COALESCE(ra.assigned_count, 0) as assigned_count,
        CEIL(er.people_count / 5.0) as max_volunteers,
        CASE 
          WHEN er.address_zone IS NULL THEN 1
          WHEN er.address_zone ILIKE $1 THEN 2
          WHEN $1 ILIKE '%' || er.address_zone || '%' THEN 3
          ELSE 4
        END as zone_match_score
      FROM emergency_requests er
      LEFT JOIN (
        SELECT request_id, COUNT(*) as assigned_count
        FROM request_assignments
        WHERE status IN ('assigned', 'in_progress', 'accepted')
        GROUP BY request_id
      ) ra ON er.id = ra.request_id
      WHERE er.status IN ('pending', 'partially_assigned')
  AND (COALESCE(ra.assigned_count, 0) < CEIL(er.people_count / 5.0))
  AND (
    er.address_zone ILIKE $1 OR 
    $1 ILIKE '%' || er.address_zone || '%'
  ) -- This line ensures only matching zones are returned
  AND er.id NOT IN (
    SELECT request_id 
    FROM request_assignments 
    WHERE volunteer_id = $2
  )
    `;

    const params = [volunteer.zone || '', volunteer_id];
    
    if (volunteer.zone) {
      query += ` 
        ORDER BY 
          zone_match_score,
          er.severity DESC,
          er.created_at DESC
      `;
    } else {
      query += ` 
        ORDER BY 
          er.severity DESC,
          er.created_at DESC
      `;
    }

    console.log("📋 Query:", query);
    console.log("📋 Params:", params);

    const requestsResult = await client.query(query, params);
    
    console.log(`✅ Found ${requestsResult.rows.length} available requests for volunteer ${volunteer.name}`);
    
    if (requestsResult.rows.length > 0) {
      console.log("Available requests:");
      requestsResult.rows.forEach((req, i) => {
        console.log(`  ${i + 1}. ID: ${req.id}, Type: ${req.emergency_type}, Zone: ${req.address_zone}, Severity: ${req.severity}`);
      });
    }

    res.json({
      success: true,
      data: requestsResult.rows,
      volunteer: {
        name: volunteer.name,
        zone: volunteer.zone,
        available: volunteer.available
      }
    });

  } catch (err) {
    console.error("❌ AVAILABLE REQUESTS ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch available requests",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get("/debug/volunteers", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const volunteers = await client.query(`
      SELECT id, name, email, zone, available, account_status, 
             last_active, skills, created_at
      FROM volunteers
      ORDER BY available DESC, last_active DESC
    `);
    
    const requests = await client.query(`
      SELECT id, emergency_type, address_zone, status, 
             severity, people_count, created_at
      FROM emergency_requests
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    const notifications = await client.query(`
      SELECT n.id, n.user_id, n.request_id, n.message, 
             n.notification_type, n.status, n.created_at,
             v.name as volunteer_name, v.zone as volunteer_zone
      FROM notifications n
      LEFT JOIN volunteers v ON n.user_id = v.id
      WHERE n.user_type = 'volunteer'
      ORDER BY n.created_at DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: {
        totalVolunteers: volunteers.rows.length,
        availableVolunteers: volunteers.rows.filter(v => v.available && v.account_status === 'active').length,
        volunteers: volunteers.rows,
        recentRequests: requests.rows,
        recentNotifications: notifications.rows
      }
    });
    
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ success: false, message: "Debug failed" });
  } finally {
    if (client) client.release();
  }
});


router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const volunteerId = req.user.id;

    const result = await pool.query(
      `SELECT id, name, email, phone, zone, address, skills, 
              experience_level, experience_years, availability,
              total_assignments, completed_assignments, 
              total_people_served, total_hours_volunteered,
              rating, profile_completed, available, account_status,
              created_at, last_active, last_login
       FROM volunteers 
       WHERE id = $1`,
      [volunteerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
});

router.get("/assignments/:id", authMiddleware, async (req, res) => {
  try {
    const volunteerId = req.user.id;

    const result = await pool.query(
      `SELECT ra.*, 
              er.emergency_type, 
              er.description, 
              er.people_count, 
              er.contact_number, 
              er.address, 
              er.severity, 
              er.status as request_status,
              er.created_at as request_created
       FROM request_assignments ra
       LEFT JOIN emergency_requests er 
              ON ra.request_id = er.id
       WHERE ra.volunteer_id = $1
       ORDER BY ra.assigned_at DESC`,
      [volunteerId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("GET ASSIGNMENTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assignments"
    });
  }
});

router.put("/availability", authMiddleware, async (req, res) => {
  try {
    const { available } = req.body;
    const volunteerId = req.user.id;

    if (typeof available !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Available must be true or false"
      });
    }

    const result = await pool.query(
      `UPDATE volunteers 
       SET available = $1, last_active = NOW()
       WHERE id = $2
       RETURNING id, name, available, last_active`,
      [available, volunteerId]
    );

    res.json({
      success: true,
      message: `You are now ${available ? 'available' : 'unavailable'}`,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("UPDATE AVAILABILITY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update availability"
    });
  }
});

router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `UPDATE volunteers 
       SET email_verified = TRUE, 
           account_status = 'active',
           verification_token = NULL,
           updated_at = NOW()
       WHERE verification_token = $1 
       RETURNING id, name, email`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired verification token" 
      });
    }

    const volunteer = result.rows[0];

    res.json({
      success: true,
      message: "Email verified successfully!",
      data: volunteer
    });

  } catch (err) {
    console.error("EMAIL VERIFICATION ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Verification failed" 
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const result = await pool.query(
      "SELECT id, name, email FROM volunteers WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "If your email is registered, you will receive a password reset link."
      });
    }

    const volunteer = result.rows[0];
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await pool.query(
      `UPDATE volunteers 
       SET reset_token = $1, 
           reset_token_expiry = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [resetToken, resetTokenExpiry, volunteer.id]
    );


    res.json({
      success: true,
      message: "Password reset link sent to your email"
    });

  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to process request" 
    });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Password and confirmation are required" 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Passwords do not match" 
      });
    }

    const result = await pool.query(
      `SELECT id FROM volunteers 
       WHERE reset_token = $1 
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired reset token" 
      });
    }

    const volunteer = result.rows[0];

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await pool.query(
      `UPDATE volunteers 
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expiry = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, volunteer.id]
    );

    res.json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to reset password" 
    });
  }
});

router.get("/nearby", authMiddleware, async (req, res) => {
  try {
    const { zone, skills, limit = 10 } = req.query;

    let query = `
      SELECT id, name, phone, zone, skills, experience_level, 
             availability, available, last_active,
             total_assignments, completed_assignments, rating
      FROM volunteers 
      WHERE account_status = 'active' 
      AND available = TRUE
    `;

    const params = [];
    let paramCount = 1;

    if (zone) {
      query += ` AND zone ILIKE $${paramCount}`;
      params.push(`%${zone}%`);
      paramCount++;
    }

    if (skills) {
      const skillList = skills.split(',').map(s => s.trim());
      query += ` AND skills @> $${paramCount}::text[]`;
      params.push(skillList);
      paramCount++;
    }

    query += ` ORDER BY last_active DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("NEARBY VOLUNTEERS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch nearby volunteers"
    });
  }
});

router.post("/accept-request", authMiddleware, async (req, res) => {
  let client;
  try {
    const { request_id } = req.body;
    const volunteer_id = req.user.id;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required"
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const volunteerCheck = await client.query(
      `SELECT id, available, name 
       FROM volunteers 
       WHERE id = $1 AND account_status = 'active'`,
      [volunteer_id]
    );

    if (volunteerCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Volunteer not found"
      });
    }

    if (!volunteerCheck.rows[0].available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "You are not available to accept assignments"
      });
    }

    const requestResult = await client.query(
      `SELECT id, guest_id, people_count, status, emergency_type
       FROM emergency_requests 
       WHERE id = $1`,
      [request_id]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Emergency request not found"
      });
    }

    const emergencyRequest = requestResult.rows[0];

    if (!["pending", "partially_assigned"].includes(emergencyRequest.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This request is no longer available"
      });
    }

    const maxVolunteers = Math.max(
      1,
      Math.ceil(emergencyRequest.people_count / 5)
    );

    const assignedResult = await client.query(
      `SELECT COUNT(*) 
       FROM request_assignments 
       WHERE request_id = $1 
       AND status IN ('assigned','in_progress','accepted')`,
      [request_id]
    );

    const assignedCount = parseInt(assignedResult.rows[0].count);

    if (assignedCount >= maxVolunteers) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Maximum volunteers already assigned"
      });
    }

    const alreadyAssigned = await client.query(
      `SELECT id FROM request_assignments 
       WHERE request_id = $1 AND volunteer_id = $2`,
      [request_id, volunteer_id]
    );

    if (alreadyAssigned.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "You have already accepted this request"
      });
    }

    const volunteerName = volunteerCheck.rows[0].name || "A volunteer";

    const assignmentResult = await client.query(
      `INSERT INTO request_assignments 
       (volunteer_id, request_id, status, assigned_at, started_at)
       VALUES ($1, $2, 'assigned', NOW(), NOW())
       RETURNING *`,
      [volunteer_id, request_id]
    );

    const newStatus =
      assignedCount + 1 >= maxVolunteers
        ? "assigned"
        : "partially_assigned";

    await client.query(
      `UPDATE emergency_requests 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [newStatus, request_id]
    );

    await client.query(
      `UPDATE volunteers 
       SET last_active = NOW(),
           total_assignments = COALESCE(total_assignments, 0) + 1
       WHERE id = $1`,
      [volunteer_id]
    );

    await client.query(
      `INSERT INTO notifications 
       (user_id, user_type, request_id, message, notification_type, status, created_at)
       VALUES ($1, 'guest', $2, $3, 'assignment', 'unread', NOW())`,
      [
        emergencyRequest.guest_id,
        request_id,
        `${volunteerName} has accepted your ${emergencyRequest.emergency_type.replace("_", " ")} emergency request. Help is on the way!`
      ]
    );

    await client.query(
      `INSERT INTO notifications 
       (user_id, user_type, request_id, message, notification_type, status, created_at)
       VALUES ($1, 'volunteer', $2, $3, 'confirmation', 'unread', NOW())`,
      [
        volunteer_id,
        request_id,
        `You have accepted the ${emergencyRequest.emergency_type.replace("_", " ")} emergency request.`
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Request accepted successfully",
      data: {
        assignmentId: assignmentResult.rows[0].id,
        remainingSlots: maxVolunteers - assignedCount - 1,
        totalAssigned: assignedCount + 1
      }
    });

  } catch (err) {
    console.error("ACCEPT REQUEST ERROR:", err);

    if (client) {
      try { await client.query("ROLLBACK"); } catch {}
    }

    res.status(500).json({
      success: false,
      message: "Failed to accept request"
    });

  } finally {
    if (client) client.release();
  }
});

router.post("/assignments/:id/complete", authMiddleware, async (req, res) => {
  let client;

  try {
    const assignmentId = req.params.id;

    const volunteer_id = req.user.id;

    client = await pool.connect();
    await client.query('BEGIN');

    const assignmentCheck = await client.query(
      `SELECT ra.*, er.people_count, er.guest_id, er.emergency_type, er.id as request_id
       FROM request_assignments ra
       JOIN emergency_requests er ON ra.request_id = er.id
       WHERE ra.id = $1 AND ra.volunteer_id = $2`,
      [assignmentId, volunteer_id]
    );

    if (assignmentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Assignment not found or you don't have permission"
      });
    }

    const assignment = assignmentCheck.rows[0];

    if (assignment.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "This assignment is already completed"
      });
    }

    await client.query(
      `UPDATE request_assignments 
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [assignmentId]
    );

    await client.query(
      `UPDATE volunteers 
       SET completed_assignments = COALESCE(completed_assignments, 0) + 1,
           total_people_served = COALESCE(total_people_served, 0) + $1,
           total_hours_volunteered = COALESCE(total_hours_volunteered, 0) + 2,
           last_active = NOW()
       WHERE id = $2`,
      [assignment.people_count || 1, volunteer_id]
    );

    await client.query(
      `INSERT INTO notifications 
       (user_id, user_type, request_id, message, notification_type, status, created_at)
       VALUES ($1, 'guest', $2, $3, 'completion', 'unread', NOW())`,
      [
        assignment.guest_id,
        assignment.request_id,
        `A volunteer has completed the ${assignment.emergency_type.replace('_', ' ')} emergency response. We hope you're safe now!`
      ]
    );

    await client.query(
      `INSERT INTO notifications 
       (user_id, user_type, request_id, message, notification_type, status, created_at)
       VALUES ($1, 'volunteer', $2, $3, 'completion', 'unread', NOW())`,
      [
        volunteer_id,
        assignment.request_id,
        `You have successfully completed the ${assignment.emergency_type.replace('_', ' ')} emergency response. Thank you for your service!`
      ]
    );

    const remainingAssignments = await client.query(
      `SELECT COUNT(*) 
       FROM request_assignments 
       WHERE request_id = $1 AND status != 'completed'`,
      [assignment.request_id]
    );

    if (parseInt(remainingAssignments.rows[0].count) === 0) {
      await client.query(
        `UPDATE emergency_requests 
         SET status = 'completed'
         WHERE id = $1`,
        [assignment.request_id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Assignment marked as completed successfully!",
      data: {
        assignmentId,
        requestId: assignment.request_id,
        status: 'completed'
      }
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');

    console.error("COMPLETE ASSIGNMENT ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to complete assignment",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});
module.exports = router;
const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require('jsonwebtoken'); // Add JWT for token generation

// POST /api/volunteer - Register new volunteer
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

    // Validate required fields
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

    // Start transaction
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if email already exists
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

    // Check if phone already exists
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

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token (but we'll auto-verify for now)
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Process skills array
    let skillsArray = [];
    if (skills) {
      if (typeof skills === 'string') {
        skillsArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
      } else if (Array.isArray(skills)) {
        skillsArray = skills;
      }
    }

    // Extract experience years from experience field if not provided separately
    let finalExperienceYears = experience_years;
    if (!finalExperienceYears && experience) {
      const yearsMatch = experience.match(/\d+/);
      if (yearsMatch) {
        finalExperienceYears = parseInt(yearsMatch[0]);
      }
    }

    // Map experience level
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

    // Set default availability if not provided
    const finalAvailability = availability || 'Part-time';

    // Insert into database WITH AUTO-ACTIVATION
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

    // Try to create/update user in users table
    try {
      await client.query(
        `INSERT INTO users (name, phone, email, role, created_at)
         VALUES ($1, $2, $3, 'volunteer', NOW())`,
        [name.trim(), phone.replace(/\D/g, ''), email.trim().toLowerCase()]
      );
    } catch (err) {
      // If user already exists, just continue
      console.log("Note: Could not create user record:", err.message);
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log("Registration successful for:", email);
    
    // Generate JWT token for immediate login
    const token = jwt.sign(
      { 
        id: newVolunteer.id, 
        email: newVolunteer.email, 
        role: 'volunteer',
        name: newVolunteer.name
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
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
        token: token // Return token for auto-login if needed
      }
    });

  } catch (err) {
    // Rollback transaction on error
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    console.error("VOLUNTEER REGISTRATION ERROR:", err);
    
    if (err.code === '23505') { // Unique violation
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

// POST /api/volunteer/login - Volunteer login (UPDATED WITH JWT)
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

    // Find volunteer by email
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

    // Check if account is active - TEMPORARILY BYPASSED FOR DEVELOPMENT
    // if (volunteer.account_status !== 'active') {
    //   return res.status(403).json({ 
    //     success: false,
    //     message: "Account is not active. Please verify your email or contact support." 
    //   });
    // }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, volunteer.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check if email is verified - TEMPORARILY BYPASSED FOR DEVELOPMENT
    // if (!volunteer.email_verified) {
    //   return res.status(403).json({ 
    //     success: false,
    //     message: "Please verify your email before logging in." 
    //   });
    // }

    // Update last login and last active
    await pool.query(
      "UPDATE volunteers SET last_login = NOW(), last_active = NOW() WHERE id = $1",
      [volunteer.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: volunteer.id, 
        email: volunteer.email, 
        role: 'volunteer',
        name: volunteer.name
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    // Remove password hash from response
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

router.post("/volunteer/accept", async (req, res) => {
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

    // Check if volunteer exists and is available
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

    // Get emergency request
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

    // Count how many volunteers have already accepted
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

    // Check if this volunteer already accepted
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

    // Assign volunteer
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

// GET /api/volunteer/available-requests
// GET /api/volunteer/available-requests
router.get("/available-requests", async (req, res) => {
  let client;
  try {
    // Get volunteer from JWT
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: "Access token required" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    const volunteer_id = decoded.id;

    client = await pool.connect();

    // Get volunteer info
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

    // Find emergency requests that match volunteer's zone or any requests if no zone specified
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
    
    // If volunteer has a zone, prioritize that zone
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

// GET /api/debug/volunteers - Debug endpoint to check volunteers
router.get("/debug/volunteers", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Get all volunteers
    const volunteers = await client.query(`
      SELECT id, name, email, zone, available, account_status, 
             last_active, skills, created_at
      FROM volunteers
      ORDER BY available DESC, last_active DESC
    `);
    
    // Get all emergency requests
    const requests = await client.query(`
      SELECT id, emergency_type, address_zone, status, 
             severity, people_count, created_at
      FROM emergency_requests
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    // Get all notifications
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


// GET /api/volunteer/profile - Get logged-in volunteer profile
router.get("/profile", async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access token required" 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    } catch (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, phone, zone, address, skills, 
              experience_level, experience_years, availability,
              total_assignments, completed_assignments, 
              total_people_served, total_hours_volunteered,
              rating, profile_completed, available, account_status,
              created_at, last_active, last_login
       FROM volunteers 
       WHERE id = $1`,
      [decoded.id]
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

// GET /api/volunteer/assignments/:id - Get volunteer assignments
router.get("/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ra.*, er.emergency_type, er.description, er.people_count, 
              er.contact_number, er.address, er.severity, er.status as request_status,
              er.created_at as request_created
       FROM request_assignments ra
       LEFT JOIN emergency_requests er ON ra.request_id = er.id
       WHERE ra.volunteer_id = $1
       ORDER BY ra.assigned_at DESC`,
      [id]
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

// PUT /api/volunteer/availability - Update availability status
router.put("/availability", async (req, res) => {
  try {
    const { available } = req.body;
    
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access token required" 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    } catch (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    const result = await pool.query(
      `UPDATE volunteers 
       SET available = $1, last_active = NOW()
       WHERE id = $2
       RETURNING id, name, available, last_active`,
      [available, decoded.id]
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

// GET /api/volunteer/verify/:token - Verify email
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

// POST /api/volunteer/forgot-password - Forgot password
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
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: "If your email is registered, you will receive a password reset link."
      });
    }

    const volunteer = result.rows[0];
    
    // Generate reset token
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

    // TODO: Send password reset email
    // sendPasswordResetEmail(email, name, resetToken);

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

// POST /api/volunteer/reset-password/:token - Reset password
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

    // Check if token is valid and not expired
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

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
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

// GET /api/volunteer/nearby?zone=:zone&skills=:skills - Find nearby volunteers
router.get("/nearby", async (req, res) => {
  try {
    const { zone, skills, limit = 10 } = req.query;
    let query = `
      SELECT id, name, phone, zone, skills, experience_level, 
             availability, available, last_active,
             total_assignments, completed_assignments, rating
      FROM volunteers 
      WHERE account_status = 'active' AND available = TRUE AND(zone ILIKE $1 OR zone IS NULL)
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

// POST /api/volunteer/accept-request - Volunteer accepts an emergency request
router.post("/accept-request", async (req, res) => {
  let client;
  try {
    const { request_id } = req.body;
    
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access token required" 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    } catch (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    const volunteer_id = decoded.id;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required"
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Check if volunteer exists and is available
    const volunteerCheck = await client.query(
      `SELECT id, available, name 
       FROM volunteers 
       WHERE id = $1 AND account_status = 'active'`,
      [volunteer_id]
    );

    if (volunteerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Volunteer not found"
      });
    }

    if (!volunteerCheck.rows[0].available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "You are not available to accept assignments"
      });
    }

    // Check if emergency request exists and is still pending
    const requestResult = await client.query(
      `SELECT id, guest_id, people_count, status, address_zone, emergency_type
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
    
    if (emergencyRequest.status !== 'pending' && emergencyRequest.status !== 'partially_assigned') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "This request is no longer available for assignment"
      });
    }

    // Calculate maximum volunteers needed
    const maxVolunteers = Math.max(1, Math.ceil(emergencyRequest.people_count / 5));

    // Count how many volunteers have already accepted
    const assignedResult = await client.query(
      `SELECT COUNT(*) 
       FROM request_assignments 
       WHERE request_id = $1 AND status IN ('assigned', 'in_progress', 'accepted')`,
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

    // Check if this volunteer already accepted
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

    const volunteerName = volunteerCheck.rows[0].name || 'A volunteer';

    // Create assignment (volunteer accepts the request)
    const assignmentResult = await client.query(
      `INSERT INTO request_assignments (
        volunteer_id, request_id, status, assigned_at, started_at
      ) VALUES ($1, $2, 'assigned', NOW(), NOW())
      RETURNING *`,
      [volunteer_id, request_id]
    );

    // Update emergency request status based on volunteer count
    if (assignedCount + 1 >= maxVolunteers) {
      await client.query(
        `UPDATE emergency_requests 
         SET status = 'assigned', updated_at = NOW()
         WHERE id = $1`,
        [request_id]
      );
    } else {
      await client.query(
        `UPDATE emergency_requests 
         SET status = 'partially_assigned', updated_at = NOW()
         WHERE id = $1`,
        [request_id]
      );
    }

    // Update volunteer's last active time and assignment count
    await client.query(
      `UPDATE volunteers 
       SET last_active = NOW(),
           total_assignments = COALESCE(total_assignments, 0) + 1
       WHERE id = $1`,
      [volunteer_id]
    );

    // Create notification for the requester
    await client.query(
      `INSERT INTO notifications (
        user_id, user_type, request_id, message, notification_type, status, created_at
      ) VALUES ($1, 'guest', $2, $3, 'assignment', 'unread', NOW())`,
      [
        emergencyRequest.guest_id,
        request_id,
        `${volunteerName} has accepted your ${emergencyRequest.emergency_type.replace('_', ' ')} emergency request. Help is on the way!`
      ]
    );

    // Create notification for the volunteer
    await client.query(
      `INSERT INTO notifications (
        user_id, user_type, request_id, message, notification_type, status, created_at
      ) VALUES ($1, 'volunteer', $2, $3, 'confirmation', 'unread', NOW())`,
      [
        volunteer_id,
        request_id,
        `You have accepted the ${emergencyRequest.emergency_type.replace('_', ' ')} emergency request. Please proceed to the location.`
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "You have successfully accepted the emergency request",
      data: {
        assignmentId: assignmentResult.rows[0].id,
        requestId: request_id,
        remainingSlots: maxVolunteers - assignedCount - 1,
        totalAssigned: assignedCount + 1
      }
    });

  } catch (err) {
    console.error("VOLUNTEER ACCEPT REQUEST ERROR:", err);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to accept the request. Try again later.",
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
module.exports = router;
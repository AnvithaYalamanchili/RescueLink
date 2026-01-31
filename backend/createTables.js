// backend/createTables.js
const pool = require("./db");

const createTables = async () => {
  try {
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'guest', -- guest, volunteer, admin
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Emergency Types Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE,
        default_assignment VARCHAR(20) -- volunteer, ngo, government
      );
    `);

    // Disaster Events Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disaster_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50),
        name VARCHAR(100),
        severity VARCHAR(20), -- minor, moderate, major, critical
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        affected_zones TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Emergency Requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guest_id UUID REFERENCES users(id),
        emergency_type VARCHAR(50) NOT NULL,
        description TEXT,
        people_count INT DEFAULT 1,
        contact_number VARCHAR(20),
        can_call BOOLEAN DEFAULT FALSE,
        lat NUMERIC(9,6),
        lng NUMERIC(9,6),
        address TEXT,
        severity VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
        status VARCHAR(20) DEFAULT 'pending', -- pending, assigned, in_progress, completed
        disaster_event_id UUID REFERENCES disaster_events(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Volunteers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        phone VARCHAR(20),
        skills TEXT[],
        lat NUMERIC(9,6),
        lng NUMERIC(9,6),
        zone VARCHAR(50),
        available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Request Assignments (Volunteer)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES emergency_requests(id) ON DELETE CASCADE,
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'assigned',
        assigned_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Relief Providers (NGOs, shelters)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS relief_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        type_of_relief TEXT[],
        capacity INT,
        lat NUMERIC(9,6),
        lng NUMERIC(9,6),
        zone VARCHAR(50),
        address TEXT,
        contact_number VARCHAR(20),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Relief Assignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS relief_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES emergency_requests(id) ON DELETE CASCADE,
        provider_id UUID REFERENCES relief_providers(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'assigned'
      );
    `);

    // Assignment Status History (volunteers & relief)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignment_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id UUID NOT NULL,
        assignment_type VARCHAR(20) NOT NULL, -- volunteer / relief
        status VARCHAR(20),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES emergency_requests(id),
        user_id UUID REFERENCES users(id),
        message TEXT,
        status VARCHAR(20) DEFAULT 'unread', -- unread, read
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("All tables created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
};

createTables();

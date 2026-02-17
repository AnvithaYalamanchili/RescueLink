// backend/createTables.js
const pool = require("./db");

const createTables = async () => {
  try {
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Users Table with unique email constraint
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100) UNIQUE NOT NULL, -- Added UNIQUE and NOT NULL constraints
        role VARCHAR(20) DEFAULT 'guest', -- guest, volunteer, admin
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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

    // Add address_zone to emergency_requests if not exists
const addressZoneColumn = await pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'emergency_requests' 
    AND column_name = 'address_zone'
  );
`);

if (!addressZoneColumn.rows[0].exists) {
  await pool.query(`
    ALTER TABLE emergency_requests 
    ADD COLUMN address_zone VARCHAR(100);
  `);
  console.log("Added column 'address_zone' to emergency_requests");
}


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
        current_lat NUMERIC(9,6), -- Live moving location
        current_lng NUMERIC(9,6), -- Live moving location
        last_ping_at TIMESTAMP,
        address TEXT,
        severity VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
        status VARCHAR(20) DEFAULT 'pending', -- pending, assigned, in_progress, completed
        disaster_event_id UUID REFERENCES disaster_events(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Volunteers - First check if table exists, then alter if needed
    console.log("Creating/Updating volunteers table...");
    
    // Check if volunteers table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'volunteers'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create new table with all columns
      await pool.query(`
        CREATE TABLE volunteers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Basic Information
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(20) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          
          -- Location
          zone VARCHAR(100) NOT NULL,
          lat NUMERIC(9,6),
          lng NUMERIC(9,6),
          address TEXT,
          
          -- Skills & Experience
          skills TEXT[] DEFAULT '{}',
          experience_level VARCHAR(50), -- Beginner, Intermediate, Experienced, Expert
          experience_years INT,
          
          -- Availability
          availability VARCHAR(50) DEFAULT 'Part-time', -- Full-time, Part-time, Weekends Only, On-call/Emergency, Flexible
          available BOOLEAN DEFAULT TRUE,
          last_active TIMESTAMP,
          
          -- Account Status
          email_verified BOOLEAN DEFAULT FALSE,
          account_status VARCHAR(20) DEFAULT 'pending', -- pending, active, suspended, inactive
          verification_token VARCHAR(255),
          reset_token VARCHAR(255),
          reset_token_expiry TIMESTAMP,
          
          -- Preferences
          notification_preferences JSONB DEFAULT '{
            "email": true,
            "sms": true,
            "push": true,
            "emergency_alerts": true
          }'::jsonb,
          
          -- Statistics
          total_assignments INT DEFAULT 0,
          completed_assignments INT DEFAULT 0,
          total_people_served INT DEFAULT 0,
          total_hours_volunteered DECIMAL(10,2) DEFAULT 0,
          rating DECIMAL(3,2) DEFAULT 0,
          
          -- Terms & Tracking
          agreed_to_terms BOOLEAN DEFAULT FALSE,
          terms_agreed_at TIMESTAMP,
          profile_completed BOOLEAN DEFAULT FALSE,
          
          -- Timestamps
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP
        );
      `);
      console.log("Created new volunteers table.");
    } else {
      // Table exists, add missing columns
      console.log("Volunteers table exists, adding missing columns...");
      
      const alterColumns = [
        // Basic Information
        { column: 'email', type: 'VARCHAR(100)', unique: true },
        { column: 'password_hash', type: 'VARCHAR(255)' },
        
        // Location
        { column: 'zone', type: 'VARCHAR(100)' },
        { column: 'lat', type: 'NUMERIC(9,6)' },
        { column: 'lng', type: 'NUMERIC(9,6)' },
        { column: 'address', type: 'TEXT' },
        
        // Skills & Experience
        { column: 'skills', type: 'TEXT[] DEFAULT \'{}\'' },
        { column: 'experience_level', type: 'VARCHAR(50)' },
        { column: 'experience_years', type: 'INT' },
        
        // Availability
        { column: 'availability', type: 'VARCHAR(50) DEFAULT \'Part-time\'' },
        { column: 'last_active', type: 'TIMESTAMP' },
        
        // Account Status
        { column: 'email_verified', type: 'BOOLEAN DEFAULT FALSE' },
        { column: 'account_status', type: 'VARCHAR(20) DEFAULT \'pending\'' },
        { column: 'verification_token', type: 'VARCHAR(255)' },
        { column: 'reset_token', type: 'VARCHAR(255)' },
        { column: 'reset_token_expiry', type: 'TIMESTAMP' },
        
        // Preferences
        { column: 'notification_preferences', type: 'JSONB DEFAULT \'{"email": true, "sms": true, "push": true, "emergency_alerts": true}\'::jsonb' },
        
        // Statistics
        { column: 'total_assignments', type: 'INT DEFAULT 0' },
        { column: 'completed_assignments', type: 'INT DEFAULT 0' },
        { column: 'total_people_served', type: 'INT DEFAULT 0' },
        { column: 'total_hours_volunteered', type: 'DECIMAL(10,2) DEFAULT 0' },
        { column: 'rating', type: 'DECIMAL(3,2) DEFAULT 0' },
        
        // Terms & Tracking
        { column: 'agreed_to_terms', type: 'BOOLEAN DEFAULT FALSE' },
        { column: 'terms_agreed_at', type: 'TIMESTAMP' },
        { column: 'profile_completed', type: 'BOOLEAN DEFAULT FALSE' },
        
        // Timestamps
        { column: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
        { column: 'last_login', type: 'TIMESTAMP' }
      ];
      
      for (const col of alterColumns) {
        try {
          // Check if column exists
          const columnExists = await pool.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'volunteers' AND column_name = '${col.column}'
            );
          `);
          
          if (!columnExists.rows[0].exists) {
            await pool.query(`ALTER TABLE volunteers ADD COLUMN ${col.column} ${col.type};`);
            console.log(`Added column: ${col.column}`);
            
            // Add unique constraint for email
            if (col.column === 'email' && col.unique) {
              try {
                await pool.query(`ALTER TABLE volunteers ADD CONSTRAINT unique_volunteer_email UNIQUE (email);`);
                console.log("Added unique constraint for volunteers.email");
              } catch (constraintErr) {
                console.log("Unique constraint may already exist:", constraintErr.message);
              }
            }
          }
        } catch (err) {
          console.log(`Warning: Could not add column ${col.column}:`, err.message);
        }
      }
    }

    // Create indexes for better performance
    console.log("Creating indexes...");
    const indexes = [
      { name: 'idx_volunteers_email', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_email ON volunteers(email);' },
      { name: 'idx_volunteers_phone', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_phone ON volunteers(phone);' },
      { name: 'idx_volunteers_zone', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_zone ON volunteers(zone);' },
      { name: 'idx_volunteers_availability', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_availability ON volunteers(availability);' },
      { name: 'idx_volunteers_skills', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_skills ON volunteers USING GIN(skills);' },
      { name: 'idx_volunteers_available', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_available ON volunteers(available);' },
      { name: 'idx_volunteers_account_status', query: 'CREATE INDEX IF NOT EXISTS idx_volunteers_account_status ON volunteers(account_status);' },
      { name: 'idx_users_email', query: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);' },
      { name: 'idx_users_role', query: 'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);' }
    ];

    for (const idx of indexes) {
      try {
        await pool.query(idx.query);
        console.log(`Created index: ${idx.name}`);
      } catch (err) {
        console.log(`Warning: Could not create index ${idx.name}:`, err.message);
      }
    }

    // Request Assignments (Volunteer)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES emergency_requests(id) ON DELETE CASCADE,
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'assigned',
        volunteer_current_lat NUMERIC(9,6),
        volunteer_current_lng NUMERIC(9,6),
        v_last_ping_at TIMESTAMP,
        people_served INT DEFAULT 0,
        assigned_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        
        -- Volunteer feedback
        volunteer_rating INT CHECK (volunteer_rating >= 1 AND volunteer_rating <= 5),
        volunteer_feedback TEXT,
        volunteer_hours DECIMAL(5,2),
        
        -- Request feedback
        request_rating INT CHECK (request_rating >= 1 AND request_rating <= 5),
        request_feedback TEXT
      );
    `);

    // Volunteer Skills Lookup Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        skill_name VARCHAR(100) NOT NULL,
        skill_level VARCHAR(20) DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert
        certification_date DATE,
        certified_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Volunteer Availability Schedule
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
        start_time TIME,
        end_time TIME,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Volunteer Training Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_trainings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        training_name VARCHAR(200) NOT NULL,
        training_type VARCHAR(100), -- online, in-person, certification
        completed_date DATE,
        expiry_date DATE,
        certificate_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
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

    // Assignment Status History
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignment_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id UUID NOT NULL,
        assignment_type VARCHAR(20) NOT NULL, -- volunteer / relief
        status VARCHAR(20),
        notes TEXT,
        updated_by UUID,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        user_type VARCHAR(20), -- user, volunteer, admin
        request_id UUID REFERENCES emergency_requests(id),
        message TEXT,
        notification_type VARCHAR(50), -- assignment, alert, update, reminder
        status VARCHAR(20) DEFAULT 'unread', -- unread, read
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Volunteer Login Sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert default emergency types (if not exists)
    await pool.query(`
      INSERT INTO emergency_types (name, default_assignment) VALUES
        ('Medical Emergency', 'volunteer'),
        ('Fire', 'volunteer'),
        ('Flood', 'volunteer'),
        ('Earthquake', 'volunteer'),
        ('Trapped/Rescue', 'volunteer'),
        ('Food/Water', 'relief'),
        ('Shelter', 'relief'),
        ('Clothing', 'relief'),
        ('Transportation', 'volunteer'),
        ('Psychological Support', 'volunteer')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log("All tables created/updated successfully!");
    
    // Create or replace trigger function for volunteers
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Drop existing trigger if exists and recreate for volunteers
    await pool.query(`
      DROP TRIGGER IF EXISTS update_volunteers_updated_at ON volunteers;
    `);
    
    await pool.query(`
      CREATE TRIGGER update_volunteers_updated_at
      BEFORE UPDATE ON volunteers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create trigger for users table
    await pool.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    `);
    
    await pool.query(`
      CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log("Triggers created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
};

// Function to drop all tables
const dropAllTables = async () => {
  try {
    const tables = [
      'volunteer_sessions',
      'notifications',
      'assignment_status_history',
      'relief_assignments',
      'relief_providers',
      'volunteer_trainings',
      'volunteer_availability',
      'volunteer_skills',
      'request_assignments',
      'volunteers',
      'emergency_requests',
      'disaster_events',
      'emergency_types',
      'users'
    ];

    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`Dropped table: ${table}`);
    }
    
    console.log("All tables dropped successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error dropping tables:", err);
    process.exit(1);
  }
};

// Check command line arguments
if (process.argv[2] === '--drop') {
  dropAllTables();
} else {
  createTables();
}
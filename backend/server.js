require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing!");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/api/emergency", require("./routes/emergency"));
app.use("/api/volunteer", require("./routes/volunteer"));
app.use("/api/relief", require("./routes/relief"));
app.use("/api/notifications", require("./routes/notifications"));

app.get("/", (req, res) => {
  res.send("RescueLink API is running");
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store room mappings and active locations
const roomMappings = new Map(); // urlParam -> actualRequestId
const activeLocations = new Map(); // requestId -> Map of volunteerId -> location

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  console.log("Transport:", socket.conn.transport.name);

  // User joins emergency room
  socket.on("joinRequestRoom", (requestId) => {
    const roomName = requestId;
    socket.join(roomName);
    console.log(`✅ User ${socket.id} joined room: ${roomName}`);
    
    // Send current locations for this room if any
    if (activeLocations.has(requestId)) {
      const locations = activeLocations.get(requestId);
      console.log(`📤 Sending ${locations.size} existing locations to new joiner in room ${requestId}`);
      locations.forEach((location, volunteerId) => {
        socket.emit("volunteerLocation", {
          volunteerId,
          lat: location.lat,
          lng: location.lng,
          requestId,
          isHistorical: true
        });
      });
    }
    
    socket.emit("roomJoined", { room: roomName, success: true });
  });

  // Allow client to map URL param to actual request ID
  socket.on("mapRoom", (data) => {
    const { urlParam, actualRequestId } = data;
    roomMappings.set(urlParam, actualRequestId);
    console.log(`🔄 Mapped URL param ${urlParam} to actual request ID ${actualRequestId}`);
    
    // Also join the actual request ID room
    socket.join(actualRequestId);
    console.log(`✅ User ${socket.id} also joined actual room: ${actualRequestId}`);
    
    socket.emit("mappingComplete", { urlParam, actualRequestId });
  });

  // Request current locations
  socket.on("requestLocations", (data) => {
    const { requestId } = data;
    console.log(`📤 Client requested locations for request ${requestId}`);
    
    if (activeLocations.has(requestId)) {
      const locations = activeLocations.get(requestId);
      console.log(`📤 Sending ${locations.size} locations to client`);
      locations.forEach((location, volunteerId) => {
        socket.emit("volunteerLocation", {
          volunteerId,
          lat: location.lat,
          lng: location.lng,
          requestId,
          isHistorical: true
        });
      });
    } else {
      console.log(`📤 No active locations for request ${requestId}`);
    }
  });

  // Volunteer sends location
  socket.on("volunteerLocation", (data) => {
    const { requestId, volunteerId, lat, lng } = data;

    console.log("\n📍 VOLUNTEER LOCATION EVENT RECEIVED");
    console.log("From socket:", socket.id);
    console.log("Request ID:", requestId);
    console.log("Volunteer ID:", volunteerId);
    console.log("Coordinates:", lat, lng);
    console.log("Data type:", typeof data);
    console.log("Full data:", JSON.stringify(data));

    if (!requestId || !volunteerId || lat === undefined || lng === undefined) {
      console.log("❌ Invalid volunteerLocation data received:", data);
      return;
    }

    // Store in active locations
    if (!activeLocations.has(requestId)) {
      activeLocations.set(requestId, new Map());
    }
    activeLocations.get(requestId).set(volunteerId, { lat, lng, timestamp: Date.now() });
    console.log(`💾 Stored location for volunteer ${volunteerId} in request ${requestId}`);

    // Send to the room that matches the request ID
    console.log(`📤 Sending to room: ${requestId}`);
    io.to(requestId).emit("volunteerLocation", {
      volunteerId,
      lat,
      lng,
      requestId
    });
    
    // Also send to any mapped URL params
    let mappedCount = 0;
    for (const [urlParam, actualId] of roomMappings.entries()) {
      if (actualId === requestId) {
        console.log(`📤 Also sending to mapped room: ${urlParam}`);
        io.to(urlParam).emit("volunteerLocation", {
          volunteerId,
          lat,
          lng,
          requestId
        });
        mappedCount++;
      }
    }
    
    console.log(`✅ Location broadcast to ${mappedCount} mapped rooms and main room ${requestId}`);
    
    // Confirm to sender
    socket.emit("locationSent", { 
      success: true, 
      requestId, 
      volunteerId,
      timestamp: Date.now() 
    });
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Clean up old locations every minute
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (const [requestId, locations] of activeLocations.entries()) {
    for (const [volunteerId, data] of locations.entries()) {
      if (now - data.timestamp > timeout) {
        locations.delete(volunteerId);
        console.log(`🧹 Removed stale location for volunteer ${volunteerId} in request ${requestId}`);
      }
    }
    if (locations.size === 0) {
      activeLocations.delete(requestId);
    }
  }
}, 60000);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
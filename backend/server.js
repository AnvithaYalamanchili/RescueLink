require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing!");
  process.exit(1);
}

const express=require("express");
const cors=require("cors");
const http=require("http");
const {Server}=require("socket.io")

const app=express();
const PORT=process.env.PORT||5000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.use("/api/emergency",require("./routes/emergency"));
app.use("/api/volunteer",require("./routes/volunteer"));
app.use("/api/relief",require("./routes/relief"));
app.use("/api/notifications", require("./routes/notifications"));

app.get("/",(req,res)=>{
res.send("Rescuelink api is running");
})

const server=http.createServer(app);
const io=new Server(server,{
  cors:{
    origin:"http://localhost:3000",
    methods:["GET","POST"],
    credentials:true
  }
})

io.on("connection",(socket)=>{
  console.log("Client connected :",socket.id);

  socket.on("join_emergency",(emergencyId)=>{
    socket.join(`emergency_${emergencyId}`);
    console.log(`User joined room: emergency_${emergencyId}`);
  })

  socket.on("volunteer_location_update",(data)=>{
    const {emergencyId,volunteerId,latitude,longitude}=data;
    io.to(`emergency_${emergencyId}`).emit("location_update",{
      volunteerId,
      latitude,
      longitude
    })
  });
  socket.on("disconnect",()=>{
    console.log("Client disconnected :",socket.id)
  })

})

server.listen(PORT,()=>{
  console.log(`Server is running on port ${PORT}`); 
})
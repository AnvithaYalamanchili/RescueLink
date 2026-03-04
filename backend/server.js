require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing!");
  process.exit(1);
}

const express=require("express");
const cors=require("cors");

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

app.listen(PORT,()=>{
  console.log(`Server is running on port ${PORT}`); 
})
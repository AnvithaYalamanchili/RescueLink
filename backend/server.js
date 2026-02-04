const express=require("express");
const cors=require("cors");
require("dotenv").config();

const app=express();
const PORT=process.env.PORT||5000;

app.use(cors({
  origin: 'http://localhost:3000', // Your React app port
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
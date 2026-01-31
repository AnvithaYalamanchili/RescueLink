const express=require("express");
const cors=require("cors");
require("dotenv").config();

const app=express();
const PORT=process.env.PORT||5000;

app.use(cors());
app.use(express.json());

app.use("/api/emergency",require("./routes/emergency"));
app.use("/api/volunteer",require("./routes/volunteer"));
app.use("/api/relief",require("./routes/relief"));

app.get("/",(req,res)=>{
res.send("Rescuelink api is running");
})

app.listen(PORT,()=>{
  console.log(`Server is running on port ${PORT}`); 
})
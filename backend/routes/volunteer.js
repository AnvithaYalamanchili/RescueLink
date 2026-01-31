const express=require('express');
const router=express.Router();
const pool=require('../db');

router.post('/',async(req,res)=>{
    try{
        const{
            name,
            phone,
            skills,
            lat,
            lng,
            available
        }=req.body;

        const result=await pool.query(
            `INSERT INTO volunteers(name,phone,skills,lat,lng,available)
            VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name,phone,skills,lat,lng,available]);
        res.json(result.rows[0]);
    }
    catch(err){
        console.error(err.message);
        res.status(500).send("Internal server error");
    }
});
module.exports=router;
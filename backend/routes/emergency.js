const express=require("express");
const router=express.Router();
const pool=require("../db");

router.post('/',async(req,res)=>{
    try{
        const{
            guest_id,
            emergency_type,
            description,
            people_count,
            contact_number,
            can_call,
            lat,
            lng,
            address,  
        }=req.body
        const result=await pool.query(
            `INSERT INTO emergency_requests(
                guest_id,
                emergency_type,
                description,
                people_count,
                contact_number,
                can_call,
                lat,
                lng,
                address
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
                guest_id,
                emergency_type,
                description,
                people_count,
                contact_number,
                can_call,
                lat,
                lng,
                address
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
}
);
module.exports=router;
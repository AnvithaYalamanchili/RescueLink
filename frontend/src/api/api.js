import axios from "axios";
const API_URL="http://localhost:5000";
export const testAPI=async()=>{
    try{
        const res=await axios.get(`${API_URL}`);
        console.log(res.data);
    }catch(err){
        console.error(err);
    }
}
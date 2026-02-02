import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- import useNavigate
import "./RequestHelp.css";

export default function RequestHelp() {
  const [form, setForm] = useState({
    emergency_type: "",
    description: "",
    people_count: 1,
    contact_number: "",
    can_call: false,
    lat: "",
    lng: "",
    address: ""  
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const navigate = useNavigate(); // <-- initialize navigate

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ text: "", type: "" });

    const data = {
      ...form,
      guest_id: "guest_" + Date.now(),
      lat: null,
      lng: null
    };

    try {
      const res = await fetch("http://localhost:5000/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      // Show success message briefly
      setMessage({ 
        text: "Help request sent successfully! Redirecting to status page...", 
        type: "success" 
      });

      // Reset form
      setForm({
        emergency_type: "",
        description: "",
        people_count: 1,
        contact_number: "",
        can_call: false,
        lat: "",
        lng: "",
        address: ""  
      });

      // Navigate to status page after short delay
      setTimeout(() => {
        // Assuming backend returns the requestId
        // If your backend doesn't return it, use guest_id or another identifier
        const requestId = result.id;
        navigate(`/status/${requestId}`);
      }, 1500); // 1.5 seconds delay to show message

    } catch (err) {
      setMessage({ 
        text: "Failed to send request. Please try again or contact emergency services directly.", 
        type: "error" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-page">
      <form onSubmit={handleSubmit}>
        <div className="emergency-header">
          <AlertTriangle className="emergency-icon" />
          <h2 className="title-help">Request Emergency Help</h2>
        </div>
        
        <div className="form-group select-container">
          <select 
            name="emergency_type" 
            value={form.emergency_type} 
            onChange={handleChange} 
            required
          >
            <option value="">Select emergency type</option>
            <option value="medical">🚑 Medical Emergency</option>
            <option value="fire">🔥 Fire Emergency</option>
            <option value="accident">🚗 Accident</option>
            <option value="flood">🌊 Flood</option>
            <option value="earthquake">🌍 Earthquake</option>
            <option value="shelter">🏠 Shelter/Relief Support</option>
            <option value="other">⚠️ Other Emergency</option>
          </select>
        </div>
        
        <div className="form-group">
          <textarea 
            name="description" 
            placeholder="Describe the situation in detail..." 
            value={form.description}
            onChange={handleChange} 
          />
        </div>
        
        <div className="form-group">
          <input 
            type="number" 
            name="people_count" 
            placeholder="Number of people affected" 
            value={form.people_count}
            onChange={handleChange} 
            min="1"
          />
        </div>
        
        <div className="form-group">
          <input 
            name="contact_number" 
            placeholder="Contact phone number" 
            value={form.contact_number}
            onChange={handleChange} 
            type="tel"
          />
        </div>
        
        <div className="checkbox-container">
          <input 
            type="checkbox" 
            name="can_call" 
            id="can-call" 
            checked={form.can_call}
            onChange={handleChange} 
          />
          <label htmlFor="can-call">
            Authorities may contact me by phone
          </label>
        </div>
        
        <div className="form-group">
          <input 
            name="address" 
            placeholder="Your current location/address" 
            value={form.address}
            onChange={handleChange} 
          />
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              Sending Request...
            </>
          ) : (
            "Request Emergency Assistance"
          )}
        </button>

        {message.text && (
          <div className={`alert-message ${message.type}-message`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}
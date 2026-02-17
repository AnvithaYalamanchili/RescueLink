import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react"; // Added for UI
import "./RequestHelp.css";

export default function RequestHelp() {
  const [form, setForm] = useState({
    emergency_type: "",
    description: "",
    people_count: 1,
    contact_number: "",
    can_call: false,
    address: "",
    severity: "medium" ,// Added severity field
    lat: null,
    lng: null,
    share_live_location: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [locationStatus, setLocationStatus] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ 
      ...form, 
      [name]: type === "checkbox" ? checked : value 
    });
  };

  const handleEmergencyTypeChange = (e) => {
    const type = e.target.value;
    setForm({ 
      ...form, 
      emergency_type: type,
      // Auto-set severity based on emergency type
      severity: getSeverityForType(type)
    });
  };

  const getSeverityForType = (type) => {
    const highSeverity = ['medical', 'fire', 'accident'];
    const mediumSeverity = ['flood', 'earthquake'];
    
    if (highSeverity.includes(type)) return "high";
    if (mediumSeverity.includes(type)) return "medium";
    return "low";
  };

  // Function to get GPS coordinates
  const getLiveLocation = () => {
  if (!navigator.geolocation) {
    setLocationStatus("Geolocation is not supported by your browser");
    return;
  }

  setLocationStatus("Acquiring GPS...");
  
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    
    // 1. Set the coordinates immediately
    setForm(prev => ({
      ...prev,
      lat: latitude,
      lng: longitude,
      share_live_location: true
    }));

    // 2. Fetch Address Name using OpenStreetMap (Free)
    try {
      setLocationStatus("Finding address...");
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            "User-Agent": "EmergencyHelpApp/1.0" // Required by Nominatim policy
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.display_name) {
        setForm(prev => ({ 
          ...prev, 
          address: data.display_name 
        }));
        setLocationStatus("Location and address captured ✓");
      }
    } catch (error) {
      console.error("Reverse Geocoding error:", error);
      setLocationStatus("Location captured (GPS), but address lookup failed.");
    }
  }, 
  (error) => {
    setLocationStatus("Location access denied. Please enable GPS.");
    setForm(prev => ({ ...prev, share_live_location: false }));
  }, 
  { enableHighAccuracy: true, timeout: 10000 });
};
  const handleLocationToggle = (e) => {
    if (e.target.checked) {
      getLiveLocation();
    } else {
      setForm(prev => ({ ...prev, lat: null, lng: null, share_live_location: false }));
      setLocationStatus("");
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  setMessage({ text: "", type: "" });

  // Basic validation
  if (!form.emergency_type) {
    setMessage({ 
      text: "Please select an emergency type", 
      type: "error" 
    });
    setIsSubmitting(false);
    return;
  }

  if (!form.description.trim()) {
    setMessage({ 
      text: "Please describe the emergency situation", 
      type: "error" 
    });
    setIsSubmitting(false);
    return;
  }

  if (!form.contact_number.trim()) {
    setMessage({ 
      text: "Please provide a contact number", 
      type: "error" 
    });
    setIsSubmitting(false);
    return;
  }

  // Validate phone number has at least 10 digits
  const phoneDigits = form.contact_number.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    setMessage({ 
      text: "Please provide a valid phone number with at least 10 digits", 
      type: "error" 
    });
    setIsSubmitting(false);
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const result = await res.json();
    
    if (result.success) {
      // Show success message
      setMessage({ 
        text: result.message || "Help request sent successfully! Redirecting to status page...", 
        type: "success" 
      });

      // Reset form
      setForm({
        emergency_type: "",
        description: "",
        people_count: 1,
        contact_number: "",
        can_call: false,
        address: "",
        severity: "medium"
      });

      // Navigate to status page after short delay
      setTimeout(() => {
        if (result.data && result.data.requestId) {
          navigate(`/status/${result.data.requestId}`);
        } else {
          setMessage({ 
            text: "Request submitted but failed to get request ID. Please contact support.", 
            type: "error" 
          });
        }
      }, 2000);
    } else {
      setMessage({ 
        text: result.message || "Failed to send request. Please try again.", 
        type: "error" 
      });
    }
  } catch (err) {
    console.error("Submission error:", err);
    setMessage({ 
      text: "Network error. Please check your internet connection and try again.", 
      type: "error" 
    });
  } finally {
    setIsSubmitting(false);
  }
};

  const emergencyTypes = [
    { value: "medical", label: "🚑 Medical Emergency" },
    { value: "fire", label: "🔥 Fire Emergency" },
    { value: "accident", label: "🚗 Accident/Trauma"},
    { value: "flood", label: "🌊 Flood/Water Emergency" },
    { value: "earthquake", label: "🌍 Earthquake" },
    { value: "trapped", label: "🆘 Trapped/Rescue Needed" },
    { value: "food_water", label: "🍞 Food/Water Shortage"},
    { value: "shelter", label: "🏠 Shelter/Housing Emergency"},
    { value: "clothing", label: "👕 Clothing/Basic Needs"},
    { value: "transport", label: "🚐 Transportation Needed"},
    { value: "psychological", label: "🧠 Psychological Support"},
    { value: "other", label: "⚠️ Other Emergency"}
  ];

  return (
    <div className="request-help-container">
      <div className="request-help-card">
        <div className="emergency-header">
          <AlertTriangle className="emergency-icon" />
          <h2 className="title-help">Request Emergency Help</h2>
          <p className="subtitle-help">
            Fill out this form to request immediate assistance. Our volunteers and partners will respond as quickly as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Emergency Type */}
          <div className="form-group">
            <label htmlFor="emergency_type">
              <span className="required">*</span> Type of Emergency
            </label>
            <select 
              id="emergency_type"
              name="emergency_type" 
              value={form.emergency_type} 
              onChange={handleEmergencyTypeChange} 
              required
              className="select-emergency"
            >
              <option value="">-- Select emergency type --</option>
              {emergencyTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {form.emergency_type && (
              <div className={`severity-indicator severity-${form.severity}`}>
                <span className="severity-label">
                  {form.severity === 'high' ? '🚨 HIGH PRIORITY' : 
                   form.severity === 'medium' ? '⚠️ MEDIUM PRIORITY' : 
                   'ℹ️ LOW PRIORITY'}
                </span>
              </div>
            )}
          </div>
          
          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">
              <span className="required">*</span> Situation Description
            </label>
            <textarea 
              id="description"
              name="description" 
              placeholder="Please describe the emergency in detail. Include: What happened? Who is involved? What immediate help is needed?" 
              value={form.description}
              onChange={handleChange} 
              rows="5"
              required
            />
            <div className="char-count">
              {form.description.length}/500 characters
            </div>
          </div>
          
          {/* People Count and Contact */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="people_count">
                Number of People Affected
              </label>
              <input 
                id="people_count"
                type="number" 
                name="people_count" 
                placeholder="How many people need help?" 
                value={form.people_count}
                onChange={handleChange} 
                min="1"
                max="100"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="contact_number">
                <span className="required">*</span> Contact Phone Number
              </label>
              <input 
                id="contact_number"
                name="contact_number" 
                placeholder="Your phone number (for follow-up)" 
                value={form.contact_number}
                onChange={handleChange} 
                type="tel"
                required
              />
            </div>
          </div>
          
          {/* Address/Location */}
          <div className="form-group">
            <label htmlFor="address">
              Location/Address
            </label>
            <input 
              id="address"
              name="address" 
              placeholder="Where is the emergency? (Street, landmark, city)" 
              value={form.address}
              onChange={handleChange} 
            />
            <p className="field-hint">
              Provide as much detail as possible to help volunteers find you
            </p>
          </div>
          
          {/* Contact Permission */}
          <div className="checkbox-container">
            <input 
              type="checkbox" 
              name="can_call" 
              id="can-call" 
              checked={form.can_call}
              onChange={handleChange} 
            />
            <label htmlFor="can-call">
              I give permission for volunteers or emergency services to contact me at the provided number
            </label>
          </div>

          {/* Severity Selection (optional, auto-set) */}
          <div className="form-group">
            <label>Emergency Priority</label>
            <div className="severity-options">
              {['low', 'medium', 'high'].map(level => (
                <label key={level} className={`severity-option ${form.severity === level ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="severity"
                    value={level}
                    checked={form.severity === level}
                    onChange={handleChange}
                  />
                  <span className={`severity-dot severity-${level}`}></span>
                  <span className="severity-text">
                    {level === 'high' ? 'High (Immediate danger)' :
                     level === 'medium' ? 'Medium (Urgent but stable)' :
                     'Low (Non-critical)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Live Location Section */}
<div className="form-group location-sharing-box">
  <div className="checkbox-container live-location-toggle">
    <input 
      type="checkbox" 
      name="share_live_location" 
      id="share-live-location" 
      checked={form.share_live_location}
      onChange={handleLocationToggle} 
    />
    <label htmlFor="share-live-location" className="live-label">
      <Navigation size={18} className="live-icon" />
      Share my precise live location with volunteers
    </label>
  </div>
  
  {locationStatus && (
    <p className={`location-status-text ${form.lat ? 'success' : 'pending'}`}>
      {locationStatus}
    </p>
  )}
  
  {form.lat && (
    <div className="coords-display">
      <MapPin size={14} /> 
      <span>{form.lat.toFixed(5)}, {form.lng.toFixed(5)} (Pinpoint Accuracy)</span>
    </div>
  )}
</div>

          {/* Disclaimer */}
          <div className="disclaimer">
            <p><strong>Important:</strong> This is a volunteer coordination service. For immediate life-threatening emergencies, please call your local emergency number first.</p>
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Submitting Request...
              </>
            ) : (
              "Request Emergency Assistance"
            )}
          </button>

          {message.text && (
            <div className={`alert-message ${message.type}-message`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
// src/pages/HomePage.js
import React from "react";
import "./HomePage.css";
import { 
  User, HeartHandshake, Building2,
  MapPin, Bell, Users, Wrench, ClipboardList, ShieldCheck
} from "lucide-react";
import {useNavigate} from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();


  return (
  <div className="homepage">
  <div
    className="top-section"
    style={{
      backgroundImage: "url('/bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}
  >
    <nav className="navbar">
    <img src="/logo.png" alt="RescueLink Logo" className="logo-img" />
      <ul className="nav-links">
        <li>Home</li>
        <li>Live Map</li>
        <li>How It Works</li>
        <li><button className="btn-login">Login</button></li>
      </ul>
    </nav>

    <section className="hero">
      <div className="hero-content">
        <h1>Fast Help. Smart Coordination.</h1>
        <h2>Where Every Second Counts.</h2>
        <p>Connecting people in need with volunteers, shelters, and emergency resources in real time.</p>
        <div className="hero-buttons">
          <button className="btn btn-primary" onClick={()=>navigate("/request-help")}>Request Help Now</button>
          <button className="btn btn-secondary">Volunteer to Help</button>
          <button className="btn btn-tertiary">Provide Relief (NGO)</button>
        </div>
      </div>
    </section>
    <div className="alerts-bar">
  <div className="alerts-scroll">
    <div className="alerts-content">
      <span>⚠️ <strong>Alerts & Updates</strong></span>
      <span>⚠ Flood Warning in Riverside Zone</span>
      <span>🏠 Shelter Open at Lincoln High School</span>
      <span>🩸 Medical Camp Open at City Hospital</span>
    </div>
  </div>
</div>

  </div>



      {/* Live Map */}
      <section className="live-map">
        <h2>Live Emergency Overview</h2>
        <div className="map-placeholder">Map Preview Here</div>
        <button className="btn btn-map">View Full Live Map</button>
      </section>




      <section className="how-it-works">
  <h2>How RescueLink Works</h2>
  <div className="steps">
    
    <div className="step">
      <User size={40} className="step-icon" />
      <h3>For Citizens</h3>
      <ul>
        <li><Bell size={16} className="li-icon" /> Report emergencies instantly</li>
        <li><MapPin size={16} className="li-icon" /> Share your location</li>
        <li><Users size={16} className="li-icon" /> Get matched with volunteers</li>
      </ul>
    </div>

    <div className="step">
      <HeartHandshake size={40} className="step-icon" />
      <h3>For Volunteers</h3>
      <ul>
        <li><ClipboardList size={16} className="li-icon" /> Register your skills</li>
        <li><MapPin size={16} className="li-icon" /> View nearby requests</li>
        <li><ShieldCheck size={16} className="li-icon" /> Provide assistance efficiently</li>
      </ul>
    </div>

    <div className="step">
      <Building2 size={40} className="step-icon" />
      <h3>For NGOs</h3>
      <ul>
        <li><ClipboardList size={16} className="li-icon" /> Manage resources & shelters</li>
        <li><Users size={16} className="li-icon" /> Coordinate with authorities</li>
        <li><Bell size={16} className="li-icon" /> Track ongoing emergencies</li>
      </ul>
    </div>

  </div>
</section>


      {/* Success stories*/}

<section className="success-stories">
  <h2>Success Stories</h2>
  <div className="stories-cards">
    <div className="story-card">
      <img src="/story1.jpg" alt="Story 1" />
      <h3>Quick Rescue During Flood</h3>
      <p>Thanks to RescueLink volunteers, 12 families were evacuated safely within 30 minutes during Riverside flooding.</p>
    </div>
    <div className="story-card">
      <img src="/story2.jpg" alt="Story 2" />
      <h3>Medical Help in Emergency</h3>
      <p>An injured worker received immediate first aid through our volunteer network, reducing hospital response time drastically.</p>
    </div>
    <div className="story-card">
      <img src="/story3.jpg" alt="Story 3" />
      <h3>Shelter Support in Winter</h3>
      <p>Over 50 homeless people were provided shelter and warm meals during the unexpected cold snap, thanks to coordinated NGOs.</p>
    </div>
  </div>
</section>
{/* Blog Section */}
<section className="blog-section">
  <h2>Latest From Our Blog</h2>
  <div className="blog-cards">

    <div className="blog-card">
      <img src="/blog1.png" alt="Emergency preparedness tips" />
      <div className="blog-content">
        <h3>How to Stay Safe During Natural Disasters</h3>
        <p>Essential preparedness tips that could save lives during floods, earthquakes, and other emergencies.</p>
        <button className="read-more">Read More →</button>
      </div>
    </div>

    <div className="blog-card">
      <img src="/blog2.jpg" alt="Volunteers helping community" />
      <div className="blog-content">
        <h3>Meet the Heroes: Stories from Our Volunteers</h3>
        <p>Discover how everyday people are making a big difference through quick response and teamwork.</p>
        <button className="read-more">Read More →</button>
      </div>
    </div>

    <div className="blog-card">
      <img src="/blog3.jpg" alt="Emergency response coordination" />
      <div className="blog-content">
        <h3>How Technology is Transforming Emergency Response</h3>
        <p>Real-time maps, instant alerts, and smart coordination are changing how help reaches people faster.</p>
        <button className="read-more">Read More →</button>
      </div>
    </div>

  </div>
</section>



      {/* Impact Stats */}
      <section className="impact-stats">
        <h2>Our Impact</h2>
        <div className="stats">
          <div className="stat">
            <h3>1,284</h3>
            <p>Requests Responded</p>
          </div>
          <div className="stat">
            <h3>342</h3>
            <p>Active Volunteers</p>
          </div>
          <div className="stat">
            <h3>58</h3>
            <p>Partner Shelters</p>
          </div>
          <div className="stat">
            <h3>17 min</h3>
            <p>Avg Response Time</p>
          </div>
        </div>
      </section>

      {/* Partner Logos */}
      <section className="partners">
        <h2>Trusted Relief Partners</h2>
        <div className="partner-logos">
          <div className="logo-placeholder">Red Cross</div>
          <div className="logo-placeholder">Local NGO</div>
          <div className="logo-placeholder">Community Group</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>© 2026 RescueLink. All Rights Reserved.</p>
          <p>About | Contact | Privacy Policy</p>
        </div>
      </footer>
      
    </div>
  );
};

export default HomePage;

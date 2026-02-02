import { useState } from "react";
export default function VolunteerRegister() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    skills: "",
    zone: ""
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("http://localhost:5000/api/volunteer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        skills: form.skills.split(",").map(s => s.trim())
      })
    });

    const data = await res.json();

    if (res.ok) {
      setMessage("✅ Registered as volunteer!");
      setForm({ name: "", phone: "", skills: "", zone: "" });
    } else {
      setMessage("❌ Registration failed");
    }
  };

  return (
    <div className="form-page">
      <h2>Volunteer Registration</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
        <input name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} required />
        <input name="skills" placeholder="Skills (e.g. first aid, rescue)" value={form.skills} onChange={handleChange} />

        <input name="zone" placeholder="Your Area/Zone" value={form.zone} onChange={handleChange} />
        <button type="submit">Register as Volunteer</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

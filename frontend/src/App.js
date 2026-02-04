import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import RequestHelp from "./pages/RequestHelp";
import RequestStatus from "./pages/RequestStatus";
import VolunteerRegister from "./pages/VolunteerRegister";
import VolunteerLogin from "./pages/VolunteerLogin";
import VolunteerDashboard from './pages/VolunteerDashboard';
import EmergencyStatus from "./pages/EmergencyStatus";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-help" element={<RequestHelp />} />
        <Route path="/volunteer-register" element={<VolunteerRegister />} />
        <Route path="/login/volunteer" element={<VolunteerLogin />} />
        <Route path="/volunteer/dashboard" element={<VolunteerDashboard />} />
        <Route path="/status/:id" element={<EmergencyStatus />} />


      </Routes>
    </Router>
  );
}

export default App;

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import RequestHelp from "./pages/RequestHelp";
import RequestStatus from "./pages/RequestStatus";
import VolunteerRegister from "./pages/VolunteerRegister";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-help" element={<RequestHelp />} />
        <Route path="/status/:requestId" element={<RequestStatus />} />
        <Route path="/volunteer-register" element={<VolunteerRegister />} />
      </Routes>
    </Router>
  );
}

export default App;

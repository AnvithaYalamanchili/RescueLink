import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import RequestHelp from "./pages/RequestHelp";
import RequestStatus from "./pages/RequestStatus";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request-help" element={<RequestHelp />} />
        <Route path="/status/:requestId" element={<RequestStatus />} />
      </Routes>
    </Router>
  );
}

export default App;

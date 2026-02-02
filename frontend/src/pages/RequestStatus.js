import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./RequestStatus.css";

export default function RequestStatus() {
  const { requestId } = useParams();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/emergency/${requestId}/status`);
        const data = await res.json();
        setStatusData(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch status:", err);
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [requestId]);

  if (loading) return <p>Loading status...</p>;
  if (!statusData || !statusData.request) return <p>Unable to load status.</p>;

  const request = statusData.request;
  const assignments = statusData.assignments || [];
  const progress = statusData.progress ?? 0;

  return (
    <div className="status-page">
      <h1>Emergency Request Status</h1>

      <div className="status-overview">
        <p><strong>Status:</strong> {request.status}</p>
        <p><strong>Emergency Type:</strong> {request.emergency_type}</p>
        <p><strong>People Affected:</strong> {request.people_count}</p>
        <p><strong>Progress:</strong> {progress}%</p>
      </div>

      <h2>Volunteer Assignments</h2>
      <table className="assignments-table">
        <thead>
          <tr>
            <th>Volunteer Name</th>
            <th>Status</th>
            <th>People Served</th>
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 ? (
            <tr>
              <td colSpan="3">No volunteers assigned yet</td>
            </tr>
          ) : (
            assignments.map(a => (
              <tr key={a.id}>
                <td>{a.volunteer_name}</td>
                <td>{a.status}</td>
                <td>{a.people_served || 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

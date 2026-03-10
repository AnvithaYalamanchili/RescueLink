import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, Clock, User, Phone, MapPin, 
  Users, CheckCircle, XCircle, Loader, Navigation
} from 'lucide-react';
import './EmergencyStatus.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";
import RoutingManager from './RoutingManager'; // Import the RoutingManager

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons
const emergencyIcon = new L.Icon({
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const volunteerIcon = new L.Icon({
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'volunteer-marker'
});

const EmergencyStatus = () => {
  const { id } = useParams(); // This is the URL param
  const [requestData, setRequestData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [volunteerLocations, setVolunteerLocations] = useState({});
  const [showMap, setShowMap] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [hasAcceptedVolunteer, setHasAcceptedVolunteer] = useState(false);
  const [actualRequestId, setActualRequestId] = useState(null);
  const [assignedVolunteers, setAssignedVolunteers] = useState([]);
  const [routeInfo, setRouteInfo] = useState({}); // Store route info (distance, duration)
  const [showRoutes, setShowRoutes] = useState(true); // Toggle routes visibility
  
  const locationsRef = useRef({});
  const socketRef = useRef(null);

  // Fetch emergency status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        console.log("🔍 Fetching status for ID:", id);
        const response = await fetch(`http://localhost:5000/api/emergency/status/${id}`);
        
        if (!response.ok) {
          throw new Error('Request not found');
        }
        
        const data = await response.json();
        console.log("✅ API Response:", data);
        
        if (data.success) {
          setRequestData(data.data);
          console.log("✅ Request Data:", data.data);
          
          // Get the actual request ID from the database
          if (data.data.id) {
            setActualRequestId(data.data.id);
            console.log("📝 Request ID from DB:", data.data.id);
          }
          
          // Check if any volunteer has accepted the request
          const volunteers = data.data.assigned_volunteers || [];
          setAssignedVolunteers(volunteers);
          const hasAccepted = volunteers.length > 0;
          setHasAcceptedVolunteer(hasAccepted);
          
          console.log("Has accepted volunteer:", hasAccepted);
          console.log("Assigned volunteers:", volunteers);
          
          // If this request has been accepted, the volunteer might be sending to this ID
          // But we need to make sure we're listening to the correct room
          if (hasAccepted && data.data.id) {
            console.log("🎯 This request should receive updates for ID:", data.data.id);
          }
          
        } else {
          setError(data.message || 'Failed to load request status');
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setError('Unable to load emergency status. Please check the request ID.');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [id]);

  // Socket connection
  useEffect(() => {
    if (!id || !hasAcceptedVolunteer || !actualRequestId) {
      console.log("⏳ Waiting for conditions:", { 
        hasId: !!id, 
        hasAccepted: hasAcceptedVolunteer, 
        hasActualId: !!actualRequestId 
      });
      return;
    }

    console.log("🔌 Connecting to socket server...");
    console.log("Will listen for locations on request ID:", actualRequestId);
    
    const socket = io("http://localhost:5000", {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected! ID:", socket.id);
      setSocketConnected(true);
      
      // Join the room with the actual request ID from the database
      console.log("📝 Joining room with request ID:", actualRequestId);
      socket.emit("joinRequestRoom", actualRequestId);
      
      // Also join with the URL param just in case
      if (id !== actualRequestId) {
        console.log("📝 Also joining room with URL param:", id);
        socket.emit("joinRequestRoom", id);
      }
    });

    socket.on("volunteerLocation", (data) => {
      console.log("🚑 VOLUNTEER LOCATION RECEIVED:", data);
      
      // Extract data with multiple possible formats
      const volunteerId = data.volunteerId || data.volunteer_id;
      const lat = data.lat || data.latitude;
      const lng = data.lng || data.longitude;
      const receivedRequestId = data.requestId || data.request_id;
      
      console.log("📍 Parsed - Volunteer ID:", volunteerId);
      console.log("📍 Parsed - Lat/Lng:", lat, lng);
      console.log("📍 Parsed - Request ID:", receivedRequestId);

      if (!volunteerId || !lat || !lng) {
        console.log("❌ Invalid data - missing fields");
        return;
      }

      // Check if this location is for our request
      // If the data includes a requestId, verify it matches
      if (receivedRequestId && receivedRequestId !== actualRequestId) {
        console.log(`⚠️ Location for different request: ${receivedRequestId} (ours: ${actualRequestId}) - ignoring`);
        return;
      }

      console.log(`✅ Valid location for volunteer ${volunteerId} on our request ${actualRequestId}`);

      // Create new location object
      const newLocation = {
        lat: Number(lat),
        lng: Number(lng),
        lastUpdate: new Date().toLocaleTimeString(),
        timestamp: Date.now()
      };

      // Update state
      setVolunteerLocations(prev => {
        const updated = {
          ...prev,
          [volunteerId]: newLocation
        };
        console.log("📊 Updated locations state. Total volunteers:", Object.keys(updated).length);
        locationsRef.current = updated;
        return updated;
      });
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      setSocketConnected(false);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Disconnected");
      setSocketConnected(false);
    });

    return () => {
      console.log("🧹 Cleaning up socket connection");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
    };
  }, [id, hasAcceptedVolunteer, actualRequestId]);

  // Handle route info updates from RoutingManager
  const handleRouteInfo = (volunteerId, info) => {
    setRouteInfo(prev => ({
      ...prev,
      [volunteerId]: info
    }));
    
    console.log(`📍 Route info for volunteer ${volunteerId}:`, info);
  };

  // Log when volunteerLocations changes
  useEffect(() => {
    console.log("🔄 volunteerLocations UPDATED:", volunteerLocations);
    console.log("📊 Number of volunteers:", Object.keys(volunteerLocations).length);
    
    if (Object.keys(volunteerLocations).length > 0) {
      console.log("✅ We have volunteer locations!");
    }
  }, [volunteerLocations]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'in_progress': return '#2196F3';
      case 'assigned': return '#FF9800';
      case 'pending': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'assigned': return 'Assigned to Volunteers';
      case 'pending': return 'Awaiting Response';
      default: return 'Unknown';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  const formatDistance = (meters) => {
    if (!meters) return 'Calculating...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="status-loading">
        <Loader size={48} className="loading-spinner" />
        <h3>Loading emergency status...</h3>
        <p>Please wait while we retrieve your request details.</p>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className="status-error">
        <XCircle size={64} color="#f44336" />
        <h3>Unable to Load Request</h3>
        <p>{error || 'Emergency request not found.'}</p>
        <p className="error-hint">
          Please check your request ID or contact support if the problem persists.
        </p>
      </div>
    );
  }

  // Prepare routes for RoutingManager
  const routes = {};
  if (hasAcceptedVolunteer && requestData.lat && requestData.lng) {
    Object.entries(volunteerLocations).forEach(([volunteerId, location]) => {
      routes[volunteerId] = {
        start: [location.lat, location.lng],
        end: [Number(requestData.lat), Number(requestData.lng)]
      };
    });
  }

  return (
    <div className="status-container">
      <div className="status-card">
        <div className="status-header">
          <div className="status-title">
            <AlertTriangle size={32} />
            <h2>Emergency Request Status</h2>
          </div>
          <div className="status-id">
            Request ID: <span>{actualRequestId || id}</span>
          </div>
        </div>

        <div className="status-overview">
          <div className="status-badge" style={{ background: getStatusColor(requestData.status) }}>
            {getStatusText(requestData.status)}
          </div>
          <div className="severity-badge" data-severity={requestData.severity}>
            {getSeverityIcon(requestData.severity)} {requestData.severity?.toUpperCase()} PRIORITY
          </div>
          <div className="timestamp">
            <Clock size={16} />
            Submitted: {formatDate(requestData.created_at)}
          </div>
          <div className="socket-status" style={{ 
            marginLeft: 'auto',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            background: !hasAcceptedVolunteer ? '#FF980022' : (socketConnected ? '#4CAF5022' : '#f4433622'),
            color: !hasAcceptedVolunteer ? '#FF9800' : (socketConnected ? '#4CAF50' : '#f44336'),
            fontWeight: 'bold'
          }}>
            {!hasAcceptedVolunteer ? '⏳ WAITING FOR VOLUNTEER' : (socketConnected ? '🟢 LIVE' : '🔴 OFFLINE')}
          </div>
        </div>

        {/* Debug info */}
        {actualRequestId && (
          <div style={{
            background: '#e3f2fd',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '20px',
            border: '1px solid #2196f3'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#2196f3' }}>
              🔌 Room Information:
            </div>
            <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
              <div>URL Param: <span style={{ color: '#ff9800', fontWeight: 'bold' }}>{id}</span></div>
              <div>Request ID (listening on): <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{actualRequestId}</span></div>
              <div>Volunteers should send to: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{actualRequestId}</span></div>
              <div>Locations received: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{Object.keys(volunteerLocations).length}</span></div>
            </div>
          </div>
        )}

        <div className="status-details">
          <div className="detail-section">
            <h3>Assigned Volunteers</h3>
            {assignedVolunteers.length > 0 ? (
              <div className="volunteer-list">
                {assignedVolunteers.map((volunteer) => (
                  <div key={volunteer.id} className="volunteer-card">
                    <User size={18} />
                    <span className="volunteer-name">{volunteer.name}</span>
                    {volunteerLocations[volunteer.id] ? (
                      <>
                        <span className="live-badge" style={{
                          background: '#4CAF50',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          marginRight: '8px'
                        }}>
                          LIVE
                        </span>
                        {routeInfo[volunteer.id] && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#2196F3',
                            fontWeight: 'bold'
                          }}>
                            🕒 {formatDuration(routeInfo[volunteer.id].duration)} • 
                            📍 {formatDistance(routeInfo[volunteer.id].distance)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#999' }}>Waiting for location...</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-volunteer">
                <Clock size={18} />
                <span>No volunteer assigned yet</span>
              </div>
            )}
          </div>
          
          <div className="detail-section">
            <h3>Emergency Details</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Type</span>
                <span className="detail-value capitalize">{requestData.emergency_type?.replace('_', ' ')}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">
                  <Users size={16} />
                  People Affected
                </span>
                <span className="detail-value">{requestData.people_count}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">
                  <MapPin size={16} />
                  Location
                </span>
                <span className="detail-value">{requestData.address || 'Not specified'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">
                  <Phone size={16} />
                  Contact
                </span>
                <span className="detail-value">{requestData.contact_number}</span>
              </div>
            </div>
          </div>

          {hasAcceptedVolunteer && (
            <div className="detail-section">
              <h3>Live Volunteers ({Object.keys(volunteerLocations).length})</h3>
              <div className="volunteer-list">
                {Object.keys(volunteerLocations).length > 0 ? (
                  Object.entries(volunteerLocations).map(([vid, location]) => {
                    const volunteer = assignedVolunteers.find(v => v.id === vid);
                    const route = routeInfo[vid];
                    return (
                      <div key={vid} className="volunteer-card">
                        <User size={18} />
                        <span className="volunteer-name">
                          {volunteer?.name || `Volunteer ${vid.substring(0, 8)}...`}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#666' }}>
                            📍 {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </span>
                          {route && (
                            <span style={{ fontSize: '11px', color: '#2196F3', fontWeight: 'bold' }}>
                              🚗 {formatDistance(route.distance)} • ⏱️ {formatDuration(route.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-volunteer">
                    <Clock size={18} />
                    <span>Waiting for volunteer locations...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="status-footer">
          <p className="footer-note">
            <strong>Note:</strong> 
            {!hasAcceptedVolunteer 
              ? " Your request is pending. We're notifying volunteers in your area. You'll be connected when a volunteer accepts."
              : " This page updates automatically. Volunteers are on their way and will contact you soon."}
          </p>
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Floating Map Button */}
      {hasAcceptedVolunteer && requestData.lat && requestData.lng && (
        <button
          className="floating-map-btn"
          onClick={() => {
            console.log("🗺️ Opening map with locations:", volunteerLocations);
            setShowMap(!showMap);
          }}
        >
          🗺️ {Object.keys(volunteerLocations).length}
        </button>
      )}

      {/* Map Modal */}
      {showMap && hasAcceptedVolunteer && requestData.lat && requestData.lng && (
        <div className="map-modal">
          <div className="map-container-wrapper">
            <div className="map-controls">
              <button 
                className="close-map-btn"
                onClick={() => setShowMap(false)}
              >
                ✕
              </button>
              {Object.keys(volunteerLocations).length > 0 && (
                <button
                  className="toggle-routes-btn"
                  onClick={() => setShowRoutes(!showRoutes)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '50px',
                    zIndex: 1000,
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Navigation size={16} />
                  {showRoutes ? 'Hide Routes' : 'Show Routes'}
                </button>
              )}
            </div>

            <MapContainer
              key={`map-${showMap}-${Object.keys(volunteerLocations).length}`}
              center={[Number(requestData.lat), Number(requestData.lng)]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Emergency Location */}
              <Marker 
                position={[Number(requestData.lat), Number(requestData.lng)]}
                icon={emergencyIcon}
              >
                <Popup>
                  <strong>🚨 Emergency Location</strong>
                  <br />
                  {requestData.address || 'No address provided'}
                </Popup>
              </Marker>

              {/* Volunteer Locations */}
              {Object.entries(volunteerLocations).map(([volunteerId, location]) => {
                console.log(`🎯 Rendering marker for volunteer ${volunteerId}:`, location);
                return (
                  <Marker
                    key={volunteerId}
                    position={[location.lat, location.lng]}
                    icon={volunteerIcon}
                  >
                    <Popup>
                      <strong>🚑 Volunteer</strong>
                      <br />
                      Name: {assignedVolunteers.find(v => v.id === volunteerId)?.name || 'Unknown'}
                      <br />
                      {routeInfo[volunteerId] && (
                        <>
                          <strong>ETA:</strong> {formatDuration(routeInfo[volunteerId].duration)}
                          <br />
                          <strong>Distance:</strong> {formatDistance(routeInfo[volunteerId].distance)}
                          <br />
                        </>
                      )}
                      <small>Last: {location.lastUpdate}</small>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Routes */}
              {showRoutes && Object.keys(routes).length > 0 && (
                <RoutingManager 
                  routes={routes}
                  onRouteInfo={handleRouteInfo}
                />
              )}
            </MapContainer>

            {/* Route Info Panel */}
            {showRoutes && Object.keys(routeInfo).length > 0 && (
              <div className="route-info-panel" style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'white',
                padding: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                maxWidth: '300px',
                zIndex: 1000
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Route Information</h4>
                {Object.entries(routeInfo).map(([volunteerId, info]) => {
                  const volunteer = assignedVolunteers.find(v => v.id === volunteerId);
                  return (
                    <div key={volunteerId} style={{
                      padding: '8px',
                      borderBottom: '1px solid #eee',
                      fontSize: '12px'
                    }}>
                      <strong>{volunteer?.name || 'Volunteer'}</strong>
                      <div>Distance: {formatDistance(info.distance)}</div>
                      <div>ETA: {formatDuration(info.duration)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyStatus;
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, Clock, User, Phone, MapPin, 
  Users, CheckCircle, XCircle, Loader 
} from 'lucide-react';
import './EmergencyStatus.css';

const EmergencyStatus = () => {
  const { id } = useParams();
  const [requestData, setRequestData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:5000/api/emergency/status/${id}`);
        
        if (!response.ok) {
          throw new Error('Request not found');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setRequestData(data.data);
        } else {
          setError(data.message || 'Failed to load request status');
        }
      } catch (err) {
        setError('Unable to load emergency status. Please check the request ID.');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchStatus();
      
      // Refresh every 30 seconds for real-time updates
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [id]);

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

  return (
    <div className="status-container">
      <div className="status-card">
        <div className="status-header">
          <div className="status-title">
            <AlertTriangle size={32} />
            <h2>Emergency Request Status</h2>
          </div>
          <div className="status-id">
            Request ID: <span>{id}</span>
          </div>
        </div>

        <div className="status-overview">
          <div className="status-badge" style={{ background: getStatusColor(requestData.status) }}>
            {getStatusText(requestData.status)}
          </div>
          <div className="severity-badge">
            {getSeverityIcon(requestData.severity)} {requestData.severity?.toUpperCase()} PRIORITY
          </div>
          <div className="timestamp">
            <Clock size={16} />
            Submitted: {formatDate(requestData.created_at)}
          </div>
        </div>

        <div className="status-details">
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

          <div className="detail-section">
            <h3>Situation Description</h3>
            <div className="description-box">
              {requestData.description}
            </div>
          </div>

          <div className="detail-section">
            <h3>Response Progress</h3>
            <div className="progress-stats">
              <div className="progress-item">
                <div className="progress-number">{requestData.volunteers_assigned || 0}</div>
                <div className="progress-label">Volunteers Assigned</div>
              </div>
              <div className="progress-item">
                <div className="progress-number">{requestData.volunteers_completed || 0}</div>
                <div className="progress-label">Tasks Completed</div>
              </div>
              <div className="progress-item">
                <div className="progress-number">{requestData.people_count || 0}</div>
                <div className="progress-label">People to Help</div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Important Information</h3>
            <div className="info-box">
              <ul>
                <li>Keep your phone accessible for volunteer calls</li>
                <li>Stay in a safe location until help arrives</li>
                <li>Do not put yourself in danger while waiting</li>
                <li>If situation worsens, call emergency services immediately</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="status-footer">
          <p className="footer-note">
            <strong>Note:</strong> This page updates automatically. Volunteers are being notified and will contact you soon.
          </p>
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyStatus;
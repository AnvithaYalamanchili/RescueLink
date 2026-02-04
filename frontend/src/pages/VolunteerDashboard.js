import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, MapPin, Bell, CheckCircle, Clock, AlertTriangle,
  Users, Award, TrendingUp, Menu, LogOut, Calendar,
  Activity, Shield, Heart, Navigation, MessageSquare,
  Settings, HelpCircle, BarChart, Mail, Phone
} from 'lucide-react';
import './VolunteerDashboard.css';

const VolunteerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [volunteerData, setVolunteerData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');
  const [availableRequests, setAvailableRequests] = useState([]);
  const [loadingStep, setLoadingStep] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // API base URL
  const API_BASE_URL = 'http://localhost:5000/api';

  // Helper function to make API calls
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const token = localStorage.getItem('volunteerToken');
    
    if (!token && endpoint !== '/volunteer/login') {
      throw new Error('No authentication token');
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(8000) // 8 second timeout
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      
      if (response.status === 401) {
        localStorage.removeItem('volunteerToken');
        navigate('/login/volunteer');
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // Fetch all volunteer data
  const fetchVolunteerData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      setLoadingStep('Loading profile...');

      // Get token from localStorage
      const token = localStorage.getItem('volunteerToken');
      
      if (!token) {
        console.log("❌ No token found, redirecting to login");
        navigate('/login/volunteer');
        return;
      }

      console.log("🔄 Fetching volunteer data...");

      // 1. Fetch profile data
      setLoadingStep('Loading profile...');
      const profileData = await apiCall('/volunteer/profile');
      
      if (!profileData.success) {
        throw new Error(profileData.message || 'Failed to load profile');
      }

      console.log("✅ Volunteer profile loaded:", profileData.data.name);
      setVolunteerData(profileData.data);

      // 2. Fetch all other data in parallel
      setLoadingStep('Loading notifications and assignments...');
      
      const volunteerId = profileData.data.id;
      
      const [notificationsData, assignmentsData, availableRequestsData] = await Promise.allSettled([
        apiCall(`/notifications/volunteer/${volunteerId}`),
        apiCall(`/volunteer/assignments/${volunteerId}`),
        apiCall('/volunteer/available-requests')
      ]);

      // Process results
      if (notificationsData.status === 'fulfilled' && notificationsData.value.success) {
        console.log("✅ Notifications loaded:", notificationsData.value.data.length);
        const notificationsList = notificationsData.value.data || [];
        setNotifications(notificationsList);
        setUnreadNotifications(notificationsList.filter(n => n.status !== 'read').length);
      } else {
        console.warn("⚠️ Failed to load notifications");
      }

      if (assignmentsData.status === 'fulfilled' && assignmentsData.value.success) {
        console.log("✅ Assignments loaded:", assignmentsData.value.data.length);
        setAssignments(assignmentsData.value.data || []);
      } else {
        console.warn("⚠️ Failed to load assignments");
      }

      if (availableRequestsData.status === 'fulfilled' && availableRequestsData.value.success) {
        console.log("✅ Available requests loaded:", availableRequestsData.value.data.length);
        setAvailableRequests(availableRequestsData.value.data || []);
      } else {
        console.warn("⚠️ Failed to load available requests");
      }

      setIsLoading(false);
      setLoadingStep('');

    } catch (error) {
      console.error('❌ Error fetching volunteer data:', error);
      setError(error.message);
      
      if (error.message.includes('Session expired') || error.message.includes('No authentication')) {
        localStorage.removeItem('volunteerToken');
        navigate('/login/volunteer');
      }
      
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [navigate]);

  // Initial load
  useEffect(() => {
    fetchVolunteerData();
    
    // Set up polling for new data (every 30 seconds)
    const intervalId = setInterval(() => {
      if (!isLoading) {
        fetchVolunteerData();
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchVolunteerData]);

  // Handle accepting a request
  const handleAcceptAssignment = async (requestId) => {
    try {
      setLoadingStep('Accepting assignment...');
      
      const result = await apiCall('/volunteer/accept-request', 'POST', {
        request_id: requestId
      });

      if (result.success) {
        alert('Request accepted successfully!');
        // Refresh data
        await fetchVolunteerData();
      } else {
        alert(result.message || 'Failed to accept request.');
      }
    } catch (error) {
      console.error('❌ Error accepting assignment:', error);
      alert(error.message || 'Failed to accept assignment. Please try again.');
    } finally {
      setLoadingStep('');
    }
  };

  // Handle completing an assignment
  const handleCompleteAssignment = async (assignmentId) => {
    try {
      setLoadingStep('Completing assignment...');
      
      const result = await apiCall(`/assignments/${assignmentId}/complete`, 'POST');
      
      if (result.success) {
        alert('Assignment marked as completed!');
        await fetchVolunteerData();
      } else {
        alert(result.message || 'Failed to complete assignment.');
      }
    } catch (error) {
      console.error('❌ Error completing assignment:', error);
      alert(error.message || 'Failed to complete assignment. Please try again.');
    } finally {
      setLoadingStep('');
    }
  };

  // Toggle availability
  const handleToggleAvailability = async () => {
    try {
      const newStatus = !volunteerData?.available;
      
      const result = await apiCall('/volunteer/availability', 'PUT', {
        available: newStatus
      });

      if (result.success) {
        setVolunteerData(prev => ({
          ...prev,
          available: newStatus,
          last_active: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('❌ Error toggling availability:', error);
      alert('Failed to update availability. Please try again.');
    }
  };

  // Mark notification as read
  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}/read`, 'PUT', {
        volunteerId: volunteerData?.id
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, status: 'read' } : n
        )
      );
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => n.status !== 'read')
        .map(n => n.id);
      
      // Mark each notification as read
      for (const id of unreadIds) {
        await apiCall(`/notifications/${id}/read`, 'PUT', {
          volunteerId: volunteerData?.id
        });
      }
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('volunteerToken');
    navigate('/login/volunteer');
  };

  // Format helpers
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Never active';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render Overview Tab
  const renderOverview = () => (
    <div className="overview-container">
      {error && (
        <div className="error-message">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e3f2fd' }}>
            <CheckCircle size={24} color="#1976d2" />
          </div>
          <div className="stat-content">
            <h3>{volunteerData?.completed_assignments || 0}</h3>
            <p>Completed Missions</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f3e5f5' }}>
            <Users size={24} color="#7b1fa2" />
          </div>
          <div className="stat-content">
            <h3>{volunteerData?.total_people_served || 0}</h3>
            <p>People Helped</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ffebee' }}>
            <Bell size={24} color="#d32f2f" />
          </div>
          <div className="stat-content">
            <h3>{unreadNotifications}</h3>
            <p>New Alerts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff3e0' }}>
            <AlertTriangle size={24} color="#f57c00" />
          </div>
          <div className="stat-content">
            <h3>{availableRequests.length}</h3>
            <p>Available Requests</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Available Emergency Requests */}
        {availableRequests.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <h3>
                <AlertTriangle size={20} />
                Available Emergency Requests
              </h3>
              <button className="view-all-btn" onClick={() => setActiveTab('assignments')}>
                View All
              </button>
            </div>
            {availableRequests.slice(0, 3).map(request => (
              <div key={request.id} className="assignment-item available">
                <div className="assignment-info">
                  <div className="assignment-type">
                    <AlertTriangle size={16} />
                    <span>{request.emergency_type || 'Emergency'}</span>
                    <span className={`priority-badge ${request.severity || 'medium'}`}>
                      {request.severity || 'medium'}
                    </span>
                  </div>
                  <div className="assignment-details">
                    <MapPin size={14} />
                    <span>{request.address || request.address_zone || 'Location not specified'}</span>
                    <span>•</span>
                    <Users size={14} />
                    <span>{request.people_count || 1} people</span>
                  </div>
                  <div className="assignment-description">
                    {request.description?.substring(0, 100)}...
                  </div>
                </div>
                <div className="assignment-actions">
                  <button 
                    className="btn-accept"
                    onClick={() => handleAcceptAssignment(request.id)}
                  >
                    Accept Request
                  </button>
                  <button 
                    className="btn-view"
                    onClick={() => navigate(`/emergency/${request.id}`)}
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Assignments */}
        <div className="section-card">
          <div className="section-header">
            <h3>
              <Activity size={20} />
              Active Assignments
            </h3>
            <button className="view-all-btn" onClick={() => setActiveTab('assignments')}>
              View All
            </button>
          </div>
          {assignments.filter(a => a.status === 'in_progress').map(assignment => (
            <div key={assignment.id} className="assignment-item active">
              <div className="assignment-info">
                <div className="assignment-type">
                  <AlertTriangle size={16} />
                  <span>{assignment.emergency_type || 'Emergency'}</span>
                  <span className={`priority-badge ${assignment.severity || 'medium'}`}>
                    {assignment.severity || 'medium'}
                  </span>
                </div>
                <div className="assignment-details">
                  <MapPin size={14} />
                  <span>{assignment.address || 'Location not specified'}</span>
                  <span>•</span>
                  <Users size={14} />
                  <span>{assignment.people_count || 1} people</span>
                </div>
              </div>
              <div className="assignment-actions">
                <button 
                  className="btn-view"
                  onClick={() => navigate(`/assignment/${assignment.id}`)}
                >
                  View Details
                </button>
                <button 
                  className="btn-complete"
                  onClick={() => handleCompleteAssignment(assignment.id)}
                >
                  Complete
                </button>
              </div>
            </div>
          ))}
          {assignments.filter(a => a.status === 'in_progress').length === 0 && (
            <p className="no-assignments">No active assignments</p>
          )}
        </div>
        
        {/* Recent Notifications */}
        <div className="section-card">
          <div className="section-header">
            <h3>
              <Bell size={20} />
              Recent Notifications
            </h3>
            {unreadNotifications > 0 && (
              <button 
                className="view-all-btn" 
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </button>
            )}
          </div>
          {notifications.slice(0, 5).map(notification => (
            <div 
              key={notification.id} 
              className={`notification-item ${notification.status === 'read' ? 'read' : 'unread'}`}
              onClick={() => handleMarkNotificationRead(notification.id)}
            >
              <div className="notification-icon">
                {notification.notification_type === 'alert' && <AlertTriangle size={16} color="#f44336" />}
                {notification.notification_type === 'assignment' && <CheckCircle size={16} color="#4caf50" />}
                {(notification.notification_type === 'update' || !notification.notification_type) && <Bell size={16} color="#2196f3" />}
              </div>
              <div className="notification-content">
                <p>{notification.message || 'New notification'}</p>
                <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
              </div>
              {notification.status !== 'read' && <div className="unread-dot"></div>}
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="no-assignments">No notifications</p>
          )}
        </div>
      </div>
    </div>
  );

  // Render Assignments Tab
  const renderAssignments = () => {
    const allAssignments = [
      ...assignments,
      ...availableRequests.map(r => ({ ...r, status: 'pending' }))
    ];

    const activeAssignments = allAssignments.filter(a => a.status === 'in_progress' || a.status === 'assigned');
    const pendingAssignments = allAssignments.filter(a => a.status === 'pending');
    const completedAssignments = allAssignments.filter(a => a.status === 'completed');

    return (
      <div className="assignments-container">
        <div className="assignments-header">
          <h2>My Assignments</h2>
          <div className="assignment-filters">
            <button 
              className={`filter-btn ${activeTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              All ({allAssignments.length})
            </button>
            <button 
              className="filter-btn"
              onClick={() => setActiveTab('active-assignments')}
            >
              Active ({activeAssignments.length})
            </button>
            <button 
              className="filter-btn"
              onClick={() => setActiveTab('pending-assignments')}
            >
              Pending ({pendingAssignments.length})
            </button>
            <button 
              className="filter-btn"
              onClick={() => setActiveTab('completed-assignments')}
            >
              Completed ({completedAssignments.length})
            </button>
          </div>
        </div>

        {allAssignments.length === 0 ? (
          <div className="no-assignments-message">
            <CheckCircle size={48} color="#ccc" />
            <h3>No assignments yet</h3>
            <p>When you're assigned to emergencies, they'll appear here.</p>
            <button 
              className="btn-refresh"
              onClick={() => fetchVolunteerData()}
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="assignments-grid">
            {allAssignments.map(assignment => (
              <div key={assignment.id} className={`assignment-card ${assignment.status}`}>
                <div className="assignment-card-header">
                  <div className="assignment-type-badge">
                    {assignment.emergency_type || 'Emergency'}
                  </div>
                  <div className={`assignment-status ${assignment.status}`}>
                    {assignment.status ? assignment.status.replace('_', ' ') : 'Unknown'}
                  </div>
                </div>

                <div className="assignment-card-body">
                  <div className="assignment-detail">
                    <MapPin size={16} />
                    <span>{assignment.address || assignment.request_location || 'Location not specified'}</span>
                  </div>
                  <div className="assignment-detail">
                    <Users size={16} />
                    <span>{assignment.people_count || 1} people</span>
                  </div>
                  <div className="assignment-detail">
                    <Clock size={16} />
                    <span>{formatTime(assignment.created_at || assignment.assigned_at)}</span>
                  </div>
                  <div className="assignment-detail">
                    <AlertTriangle size={16} />
                    <span className={`priority ${assignment.severity || 'medium'}`}>
                      {assignment.severity || 'medium'} priority
                    </span>
                  </div>
                  {assignment.description && (
                    <div className="assignment-description">
                      <p>{assignment.description.substring(0, 150)}...</p>
                    </div>
                  )}
                </div>

                <div className="assignment-card-footer">
                  {assignment.status === 'pending' && (
                    <button 
                      className="btn-accept"
                      onClick={() => handleAcceptAssignment(assignment.id)}
                    >
                      Accept Assignment
                    </button>
                  )}
                  {(assignment.status === 'in_progress' || assignment.status === 'assigned') && (
                    <>
                      <button 
                        className="btn-view"
                        onClick={() => navigate(`/assignment/${assignment.id}`)}
                      >
                        View Details
                      </button>
                      <button 
                        className="btn-complete"
                        onClick={() => handleCompleteAssignment(assignment.id)}
                      >
                        Mark Complete
                      </button>
                    </>
                  )}
                  {assignment.status === 'completed' && (
                    <button className="btn-completed" disabled>
                      <CheckCircle size={16} />
                      Completed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Profile Tab
  const renderProfile = () => (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar">
          <User size={48} />
        </div>
        <div className="profile-info">
          <h2>{volunteerData?.name || 'Volunteer'}</h2>
          <p className="profile-role">
            Volunteer • {volunteerData?.experience_level || 'Not specified'}
            {volunteerData?.experience_years && ` (${volunteerData.experience_years} years)`}
          </p>
          <div className="profile-stats">
            <span>⭐ {volunteerData?.rating || 0}/5 Rating</span>
            <span>📍 {volunteerData?.zone || 'No zone specified'}</span>
            <span>🕒 {volunteerData?.availability || 'Flexible'}</span>
          </div>
        </div>
        <button 
          className="btn-edit-profile"
          onClick={() => navigate('/volunteer/profile/edit')}
        >
          Edit Profile
        </button>
      </div>

      <div className="profile-details">
        <div className="detail-section">
          <h3>
            <User size={20} />
            Contact Information
          </h3>
          <div className="detail-row">
            <span className="detail-label">
              <Mail size={16} />
              Email
            </span>
            <span className="detail-value">{volunteerData?.email || 'Not provided'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">
              <Phone size={16} />
              Phone
            </span>
            <span className="detail-value">{volunteerData?.phone || 'Not provided'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">
              <MapPin size={16} />
              Location Zone
            </span>
            <span className="detail-value">{volunteerData?.zone || 'Not specified'}</span>
          </div>
          {volunteerData?.address && (
            <div className="detail-row">
              <span className="detail-label">
                <MapPin size={16} />
                Address
              </span>
              <span className="detail-value">{volunteerData.address}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">Account Status</span>
            <span className="detail-value">
              <span className={`status-badge ${volunteerData?.account_status || 'active'}`}>
                {volunteerData?.account_status || 'active'}
              </span>
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h3>
            <Award size={20} />
            Skills & Expertise
          </h3>
          <div className="skills-list">
            {volunteerData?.skills && volunteerData.skills.length > 0 ? (
              volunteerData.skills.map((skill, index) => (
                <span key={index} className="skill-tag">{skill}</span>
              ))
            ) : (
              <p className="no-skills">No skills added yet. Add your skills in settings.</p>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>
            <Activity size={20} />
            Availability
          </h3>
          <div className="availability-status">
            <div className="status-toggle">
              <span>Current Status:</span>
              <button 
                className={`toggle-btn ${volunteerData?.available ? 'available' : 'unavailable'}`}
                onClick={handleToggleAvailability}
              >
                <div className="toggle-dot"></div>
                <span>{volunteerData?.available ? 'Available' : 'Unavailable'}</span>
              </button>
            </div>
            <p className="availability-note">
              {volunteerData?.available 
                ? 'You will receive emergency alerts and assignments.'
                : 'You will not receive new assignments until you mark yourself as available.'}
            </p>
            <p className="last-active">
              Last active: {formatTimeAgo(volunteerData?.last_active)}
            </p>
            <p className="last-active">
              Member since: {formatDate(volunteerData?.created_at)}
            </p>
          </div>
        </div>

        <div className="detail-section">
          <h3>
            <BarChart size={20} />
            Volunteer Statistics
          </h3>
          <div className="stats-details">
            <div className="stat-detail">
              <span className="stat-label">Total Assignments</span>
              <span className="stat-value">{volunteerData?.total_assignments || 0}</span>
            </div>
            <div className="stat-detail">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{volunteerData?.completed_assignments || 0}</span>
            </div>
            <div className="stat-detail">
              <span className="stat-label">People Served</span>
              <span className="stat-value">{volunteerData?.total_people_served || 0}</span>
            </div>
            <div className="stat-detail">
              <span className="stat-label">Hours Volunteered</span>
              <span className="stat-value">{volunteerData?.total_hours_volunteered || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Training Tab
  const renderTraining = () => (
    <div className="training-container">
      <div className="training-header">
        <h2>Training & Certifications</h2>
        <button className="btn-enroll">Enroll in Training</button>
      </div>

      <div className="training-cards">
        <div className="training-card">
          <div className="training-icon" style={{ background: '#ffebee' }}>
            <Shield size={24} color="#d32f2f" />
          </div>
          <h3>First Aid & CPR</h3>
          <p>Complete basic first aid and CPR certification</p>
          <div className="training-status completed">
            <CheckCircle size={16} />
            <span>Completed</span>
          </div>
          <button className="btn-view-certificate">View Certificate</button>
        </div>

        <div className="training-card">
          <div className="training-icon" style={{ background: '#e8f5e9' }}>
            <Navigation size={24} color="#388e3c" />
          </div>
          <h3>Search & Rescue</h3>
          <p>Advanced techniques for emergency search operations</p>
          <div className="training-status in-progress">
            <Clock size={16} />
            <span>In Progress</span>
          </div>
          <button className="btn-continue">Continue Learning</button>
        </div>

        <div className="training-card">
          <div className="training-icon" style={{ background: '#e3f2fd' }}>
            <MessageSquare size={24} color="#1976d2" />
          </div>
          <h3>Crisis Communication</h3>
          <p>Effective communication during emergencies</p>
          <div className="training-status upcoming">
            <Calendar size={16} />
            <span>Starts Jan 25</span>
          </div>
          <button className="btn-enroll-course">Enroll Now</button>
        </div>
      </div>

      <div className="training-resources">
        <h3>Quick Resources</h3>
        <div className="resource-list">
          <a href="#" className="resource-item">
            <HelpCircle size={20} />
            <span>Emergency Response Guide</span>
          </a>
          <a href="#" className="resource-item">
            <HelpCircle size={20} />
            <span>Safety Protocols</span>
          </a>
          <a href="#" className="resource-item">
            <HelpCircle size={20} />
            <span>Volunteer Handbook</span>
          </a>
        </div>
      </div>
    </div>
  );

  // Loading component
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{loadingStep || 'Loading your dashboard...'}</p>
        <div className="loading-steps">
          <p>This might take a moment. Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-dashboard">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <img src="/logo.png" alt="RescueLink" className="dashboard-logo" />
            <h2>RescueLink</h2>
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={24} />
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar-small">
            <User size={32} />
          </div>
          <div className="profile-info-small">
            <h4>{volunteerData?.name || 'Volunteer'}</h4>
            <p>Volunteer • {volunteerData?.zone || 'No zone'}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={20} />
            <span>Overview</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            <CheckCircle size={20} />
            <span>Assignments</span>
            {assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length > 0 && (
              <span className="badge">
                {assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length}
              </span>
            )}
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'training' ? 'active' : ''}`}
            onClick={() => setActiveTab('training')}
          >
            <Award size={20} />
            <span>Training</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <MapPin size={20} />
            <span>Live Map</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="dashboard-header">
          <div className="header-left">
            <h1>
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'assignments' && 'My Assignments'}
              {activeTab === 'profile' && 'My Profile'}
              {activeTab === 'training' && 'Training Center'}
              {activeTab === 'map' && 'Live Emergency Map'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p className="welcome-text">
              Welcome back, {volunteerData?.name || 'Volunteer'}! Ready to make a difference today?
            </p>
          </div>
          
          <div className="header-right">
            <button 
              className="header-btn debug-btn"
              onClick={() => {
                console.log("🔍 DEBUG INFO:");
                console.log("Volunteer Data:", volunteerData);
                console.log("Notifications:", notifications);
                console.log("Assignments:", assignments);
                console.log("Available Requests:", availableRequests);
                console.log("Token:", localStorage.getItem('volunteerToken'));
                
                // Refresh data
                fetchVolunteerData();
              }}
            >
              Refresh Data
            </button>
            
            <button 
              className="header-btn emergency-btn"
              onClick={() => navigate('/request-help')}
            >
              <AlertTriangle size={20} />
              <span>Emergency Alert</span>
            </button>
            
            <button 
              className="header-btn notification-btn"
              onClick={() => setActiveTab('overview')}
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="notification-count">
                  {unreadNotifications}
                </span>
              )}
            </button>
            
            <button 
              className={`status-indicator ${volunteerData?.available ? 'available' : 'unavailable'}`}
              onClick={handleToggleAvailability}
            >
              <div className="status-dot"></div>
              <span>{volunteerData?.available ? 'Available' : 'Unavailable'}</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'assignments' && renderAssignments()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'training' && renderTraining()}
          {activeTab === 'map' && (
            <div className="map-container">
              <div className="map-placeholder">
                <MapPin size={48} color="#666" />
                <p>Live Emergency Map</p>
                <p className="map-hint">Interactive map showing nearby emergencies</p>
                <button className="btn-view-map">Open Map</button>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="settings-container">
              <h2>Settings & Preferences</h2>
              <div className="settings-grid">
                <div className="settings-card">
                  <h3>
                    <Bell size={20} />
                    Notification Settings
                  </h3>
                  <div className="settings-option">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Emergency Alerts
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />
                      New Assignments
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />
                      Updates & Announcements
                    </label>
                  </div>
                </div>
                <div className="settings-card">
                  <h3>
                    <User size={20} />
                    Account Settings
                  </h3>
                  <button className="btn-settings">Change Password</button>
                  <button className="btn-settings">Update Email</button>
                  <button className="btn-settings">Privacy Settings</button>
                </div>
                <div className="settings-card">
                  <h3>
                    <MapPin size={20} />
                    Location Preferences
                  </h3>
                  <p>Current Zone: <strong>{volunteerData?.zone || 'Not set'}</strong></p>
                  <button className="btn-settings">Change Location</button>
                  <button className="btn-settings">Set Coverage Radius</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Lock, Eye, EyeOff, Shield, 
  Smartphone, Mail, AlertCircle, LogIn
} from 'lucide-react';
import './VolunteerLogin.css';

const VolunteerLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Real API call to your backend
      const response = await fetch('http://localhost:5000/api/volunteer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Store the token in localStorage
        if (data.data.token) {
          localStorage.setItem('volunteerToken', data.data.token);
          
          // Store volunteer data if available
          if (data.data.volunteer) {
            localStorage.setItem('volunteerData', JSON.stringify(data.data.volunteer));
          }
        }
        
        // Show success message
        alert('Login successful! Redirecting to dashboard...');
        
        // Navigate to volunteer dashboard
        navigate('/volunteer/dashboard');
      } else {
        // Handle login failure
        setErrors({ 
          general: data.message || 'Login failed. Please check your credentials.' 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password/volunteer');
  };

  // Add a test login function for development
  const handleTestLogin = () => {
    // Pre-fill test credentials (remove in production)
    setFormData({
      email: 'test@example.com',
      password: 'password123',
      rememberMe: false
    });
    
    // You can also auto-login with these credentials
    // setTimeout(() => handleSubmit(new Event('submit')), 100);
  };

  return (
    <div className="volunteer-login-container">
      <div className="login-background">
        <div className="login-left-panel">
          <div className="brand-section">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="RescueLink" className="login-logo" />
              <h1 className="app-title">RescueLink</h1>
            </Link>
            <h2 className="welcome-title">Welcome Back, Volunteer!</h2>
            <p className="welcome-subtitle">
              Your dedication saves lives. Log in to continue making a difference.
            </p>
          </div>

          <div className="features-list">
            <div className="feature-item">
              <Shield size={24} className="feature-icon" />
              <div>
                <h4>Secure Access</h4>
                <p>Your data is protected with end-to-end encryption</p>
              </div>
            </div>
            <div className="feature-item">
              <Smartphone size={24} className="feature-icon" />
              <div>
                <h4>Real-time Updates</h4>
                <p>Get instant notifications about nearby emergencies</p>
              </div>
            </div>
            <div className="feature-item">
              <User size={24} className="feature-icon" />
              <div>
                <h4>Track Your Impact</h4>
                <p>Monitor your volunteer hours and contributions</p>
              </div>
            </div>
          </div>

          {/* Development only - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="test-login-note">
              <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '20px' }}>
                💡 Development Tip: Make sure your backend is running on port 5000
              </p>
              <button 
                type="button" 
                onClick={handleTestLogin}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Fill Test Credentials
              </button>
            </div>
          )}
        </div>

        <div className="login-right-panel">
          <div className="login-card">
            <div className="login-header">
              <h2>Volunteer Login</h2>
              <p>Access your volunteer dashboard</p>
            </div>

            {errors.general && (
              <div className="error-alert">
                <AlertCircle size={18} />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={18} />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your registered email"
                  className={errors.email ? 'input-error' : ''}
                  disabled={isLoading}
                />
                {errors.email && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <Lock size={18} />
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={errors.password ? 'input-error' : ''}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.password}
                  </span>
                )}
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="forgot-password-btn"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In
                  </>
                )}
              </button>

              <div className="signup-link">
                <p>
                  New to RescueLink?{' '}
                  <Link to="/volunteer-register" className="signup-text">
                    Register as Volunteer
                  </Link>
                </p>
              </div>
            </form>

            <div className="alternative-login">
              <div className="divider">
                <span>Or continue with</span>
              </div>
              <div className="social-login-buttons">
                <button type="button" className="social-btn google-btn">
                  <img src="/google-icon.svg" alt="Google" />
                  Google
                </button>
                <button type="button" className="social-btn phone-btn">
                  <Smartphone size={20} />
                  Phone
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolunteerLogin;
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Phone, MapPin, Award, Mail, Lock, 
  Eye, EyeOff, AlertCircle, CheckCircle, 
  Shield, Clock, Users, HeartHandshake
} from 'lucide-react';
import './VolunteerRegistration.css';

const VolunteerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    skills: '',
    zone: '',
    experience: '',
    availability: 'Part-time',
    agreeToTerms: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const skillsOptions = [
    'First Aid/CPR',
    'Emergency Medical',
    'Search & Rescue',
    'Firefighting',
    'Crisis Counseling',
    'Water Safety',
    'Wilderness Survival',
    'Communication',
    'Logistics',
    'Translation',
    'Technical Support',
    'Animal Rescue'
  ];

  const availabilityOptions = [
    'Full-time (40+ hrs/week)',
    'Part-time (20-40 hrs/week)',
    'Weekends Only',
    'On-call/Emergency',
    'Flexible'
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSkillToggle = (skill) => {
    const currentSkills = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(s => s) : [];
    
    if (currentSkills.includes(skill)) {
      const updatedSkills = currentSkills.filter(s => s !== skill);
      setFormData(prev => ({ ...prev, skills: updatedSkills.join(', ') }));
    } else {
      const updatedSkills = [...currentSkills, skill];
      setFormData(prev => ({ ...prev, skills: updatedSkills.join(', ') }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Enter a valid 10-digit phone number';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Include at least 1 uppercase letter and 1 number';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.zone.trim()) {
      newErrors.zone = 'Location/zone is required';
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
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
    // Create the data object exactly as backend expects
    const requestData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.replace(/\D/g, ''), // Clean phone number
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      zone: formData.zone.trim(),
      skills: formData.skills, // Keep as comma-separated string or array
      experience: formData.experience,
      availability: formData.availability,
      agreed_to_terms: formData.agreeToTerms // Note: backend expects 'agreed_to_terms' not 'agreeToTerms'
    };
    
    console.log("Sending data:", requestData); // Debug log
    
    const res = await fetch("http://localhost:5000/api/volunteer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });
    
    const responseData = await res.json();
    
    if (res.ok) {
      setRegistrationSuccess(true);
      // Clear form after successful registration
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        skills: '',
        zone: '',
        experience: '',
        availability: 'Part-time',
        agreeToTerms: false
      });
      
      // Auto-navigate to login after 3 seconds
      setTimeout(() => {
        navigate('/login/volunteer');
      }, 3000);
    } else {
      setErrors({ 
        general: responseData.message || 'Registration failed. Please try again.' 
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    setErrors({ 
      general: 'Network error. Please check your connection.' 
    });
  } finally {
    setIsLoading(false);
  }
};

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = calculatePasswordStrength(formData.password);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#e53e3e', '#ed8936', '#38a169', '#2f855a'];

  if (registrationSuccess) {
    return (
      <div className="success-container">
        <div className="success-card">
          <CheckCircle size={80} className="success-icon" />
          <h2>Registration Successful! 🎉</h2>
          <p>Thank you for joining RescueLink as a volunteer. Your dedication saves lives.</p>
          <div className="success-details">
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Check your email for verification</li>
              <li>Complete your profile in the dashboard</li>
              <li>Attend an online orientation session</li>
            </ul>
          </div>
          <p className="redirect-text">Redirecting to login page in 3 seconds...</p>
          <Link to="/login/volunteer" className="login-link-btn">
            Go to Login Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-register-container">
      <div className="register-background">
        <div className="register-left-panel">
          <div className="brand-section">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="RescueLink" className="login-logo" />
              <h1 className="app-title">RescueLink</h1>
            </Link>
            <h2 className="welcome-title">Become a Hero Today</h2>
            <p className="welcome-subtitle">
              Join our network of dedicated volunteers and make a real difference in emergencies.
            </p>
          </div>

          <div className="benefits-list">
            <div className="benefit-item">
              <HeartHandshake size={24} className="benefit-icon" />
              <div>
                <h4>Make an Impact</h4>
                <p>Directly help people in critical situations</p>
              </div>
            </div>
            <div className="benefit-item">
              <Shield size={24} className="benefit-icon" />
              <div>
                <h4>Training & Support</h4>
                <p>Free training and ongoing support</p>
              </div>
            </div>
            <div className="benefit-item">
              <Clock size={24} className="benefit-icon" />
              <div>
                <h4>Flexible Commitment</h4>
                <p>Volunteer based on your availability</p>
              </div>
            </div>
            <div className="benefit-item">
              <Users size={24} className="benefit-icon" />
              <div>
                <h4>Join a Community</h4>
                <p>Connect with like-minded volunteers</p>
              </div>
            </div>
          </div>

          <div className="stats-preview">
            <div className="stat-preview">
              <h3>342+</h3>
              <p>Active Volunteers</p>
            </div>
            <div className="stat-preview">
              <h3>17 min</h3>
              <p>Avg Response Time</p>
            </div>
            <div className="stat-preview">
              <h3>1,284+</h3>
              <p>Lives Impacted</p>
            </div>
          </div>
        </div>

        <div className="register-right-panel">
          <div className="register-card">
            <div className="register-header">
              <h2>Volunteer Registration</h2>
              <p>Join our emergency response network</p>
            </div>

            {errors.general && (
              <div className="error-alert">
                <AlertCircle size={18} />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="register-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">
                    <User size={18} />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className={errors.name ? 'input-error' : ''}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <span className="error-message">
                      <AlertCircle size={14} /> {errors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">
                    <Phone size={18} />
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit number"
                    className={errors.phone ? 'input-error' : ''}
                    disabled={isLoading}
                  />
                  {errors.phone && (
                    <span className="error-message">
                      <AlertCircle size={14} /> {errors.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={18} />
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className={errors.email ? 'input-error' : ''}
                  disabled={isLoading}
                />
                {errors.email && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.email}
                  </span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">
                    <Lock size={18} />
                    Password *
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a strong password"
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
                  {formData.password && (
                    <div className="password-strength">
                      <div className="strength-bar">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`strength-segment ${
                              passwordStrength >= level ? 'active' : ''
                            }`}
                            style={{
                              backgroundColor: passwordStrength >= level 
                                ? strengthColors[passwordStrength - 1] 
                                : '#e2e8f0'
                            }}
                          />
                        ))}
                      </div>
                      <span className="strength-text">
                        {strengthLabels[passwordStrength - 1] || 'Enter password'}
                      </span>
                    </div>
                  )}
                  {errors.password && (
                    <span className="error-message">
                      <AlertCircle size={14} /> {errors.password}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">
                    <Lock size={18} />
                    Confirm Password *
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      className={errors.confirmPassword ? 'input-error' : ''}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span className="error-message">
                      <AlertCircle size={14} /> {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="zone">
                  <MapPin size={18} />
                  Location/Zone *
                </label>
                <input
                  type="text"
                  id="zone"
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  placeholder="City, neighborhood, or zone"
                  className={errors.zone ? 'input-error' : ''}
                  disabled={isLoading}
                />
                {errors.zone && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.zone}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Award size={18} />
                  Skills & Expertise
                </label>
                <div className="skills-container">
                  <p className="skills-hint">Select your relevant skills:</p>
                  <div className="skills-grid">
                    {skillsOptions.map((skill) => {
                      const isSelected = formData.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          className={`skill-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSkillToggle(skill)}
                          disabled={isLoading}
                        >
                          {skill}
                          {isSelected && <span className="check-mark">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    placeholder="Or type custom skills (comma separated)"
                    value={formData.skills}
                    onChange={handleChange}
                    name="skills"
                    className="custom-skills-input"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="experience">
                    Experience Level
                  </label>
                  <select
                    id="experience"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    disabled={isLoading}
                  >
                    <option value="">Select experience</option>
                    <option value="Beginner">Beginner (0-1 years)</option>
                    <option value="Intermediate">Intermediate (1-3 years)</option>
                    <option value="Experienced">Experienced (3-5 years)</option>
                    <option value="Expert">Expert (5+ years)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="availability">
                    Availability
                  </label>
                  <select
                    id="availability"
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    disabled={isLoading}
                  >
                    {availabilityOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group terms-group">
  <label className="checkbox-label">
    <input
      type="checkbox"
      name="agreeToTerms"
      checked={formData.agreeToTerms}
      onChange={handleChange}
      disabled={isLoading}
    />
    <span>
      I agree to the <Link to="/terms" className="terms-link">Terms & Conditions</Link> and 
      understand my responsibilities as a volunteer. *
    </span>
  </label>
  {errors.agreeToTerms && (
    <span className="error-message">
      <AlertCircle size={14} /> {errors.agreeToTerms}
    </span>
  )}
</div>

              <button
                type="submit"
                className="register-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Registering...
                  </>
                ) : (
                  'Register as Volunteer'
                )}
              </button>

              <div className="login-link">
                <p>
                  Already have an account?{' '}
                  <Link to="/login/volunteer" className="login-text">
                    Sign in here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolunteerRegister;
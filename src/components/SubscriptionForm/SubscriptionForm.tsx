// src/components/SubscriptionForm/SubscriptionForm.tsx

import React, { useState } from 'react';
import './SubscriptionForm.css';

// Explicitly define API_URL
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface SubscriptionFormProps {
  buttonText?: string;
  placeholderText?: string;
  successMessage?: string;
  errorMessage?: string;
  className?: string; // Add className prop
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({
  buttonText = 'Subscribe Now',
  placeholderText = 'Enter your email',
  successMessage = 'Thank you for subscribing!',
  errorMessage = 'Please enter a valid email.',
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubmitted(true);
        setEmail('');
      } else {
        const data = await response.json();
        setError(data.message || 'Subscription failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`subscription-container ${className}`}>
      {submitted ? (
        <div className="subscription-success">
          <h3>{successMessage}</h3>
          <p>You'll receive exclusive deals and updates soon.</p>
        </div>
      ) : (
        <form className="subscription-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={placeholderText}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(errorMessage); // Reset error when user types
            }}
            className={error ? 'error-input' : ''}
            required
          />
          <button type="submit" className="subscribe-btn" disabled={loading}>
            {loading ? 'Subscribing...' : buttonText}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      )}
    </div>
  );
};

export default SubscriptionForm;

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/SubscriptionForm/SubscriptionForm.tsx
import { useState } from 'react';
import './SubscriptionForm.css';
// Explicitly define API_URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SubscriptionForm = ({ buttonText = 'Subscribe Now', placeholderText = 'Enter your email', successMessage = 'Thank you for subscribing!', errorMessage = 'Please enter a valid email.', className = '', }) => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
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
            }
            else {
                const data = await response.json();
                setError(data.message || 'Subscription failed');
            }
        }
        catch (err) {
            setError('Network error. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: `subscription-container ${className}`, children: submitted ? (_jsxs("div", { className: "subscription-success", children: [_jsx("h3", { children: successMessage }), _jsx("p", { children: "You'll receive exclusive deals and updates soon." })] })) : (_jsxs("form", { className: "subscription-form", onSubmit: handleSubmit, children: [_jsx("input", { type: "email", placeholder: placeholderText, value: email, onChange: (e) => {
                        setEmail(e.target.value);
                        if (error)
                            setError(errorMessage); // Reset error when user types
                    }, className: error ? 'error-input' : '', required: true }), _jsx("button", { type: "submit", className: "subscribe-btn", disabled: loading, children: loading ? 'Subscribing...' : buttonText }), error && _jsx("p", { className: "error-message", children: error })] })) }));
};
export default SubscriptionForm;

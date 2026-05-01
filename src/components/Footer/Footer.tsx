// src/components/Footer/Footer.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import SubscriptionForm from '../SubscriptionForm/SubscriptionForm';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="footer-container">
        <div className="footer-column">
          <h4>Promotions</h4>
          <ul>
            <li>
              <Link to="/subscriptions">Subscribe &amp; save</Link>
            </li>
            <li>
              <Link to="/contact">Orders &amp; fulfillment info</Link>
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h4>Help</h4>
          <ul>
            <li>
              <Link to="/contact">Customer service</Link>
            </li>
            <li>
              <Link to="/contact">Ask a question</Link>
            </li>
            <li>
              <Link to="/policies/returns">Returns</Link>
            </li>
            <li>
              <Link to="/policies/shipping">Shipping</Link>
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h4>About</h4>
          <ul>
            <li>
              <Link to="/contact">Brand &amp; contact</Link>
            </li>
            <li>
              <Link to="/contact">Careers &amp; partnerships</Link>
            </li>
            <li>
              <Link to="/policies/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link to="/policies/terms">Terms of use</Link>
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h4>Stay connected</h4>
          <p>Subscribe to our newsletter for the latest updates.</p>
          <SubscriptionForm
            className="footer-subscription-form"
            buttonText="Subscribe"
            placeholderText="Enter your email"
            successMessage="Thank you for subscribing!"
            errorMessage="Please enter a valid email."
          />
          <p className="footer-social-note" role="note">
            Connect with Zephyr Lux through the contact page for order help, press, or partnership ideas—we&apos;ll route
            your note to the right team.
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Zephyr Lux. All rights reserved.</p>
        <p className="footer-policy-links">
          <Link to="/policies">Policies</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/contact">Contact</Link>
        </p>
      </div>
    </footer>
  );
};

export default Footer;

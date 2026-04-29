// src/components/Footer/Footer.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import SubscriptionForm from '../SubscriptionForm/SubscriptionForm';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="footer-container">
        {/* Promotions Column — links go to contact until real destinations exist */}
        <div className="footer-column">
          <h4>Promotions</h4>
          <ul>
            <li>
              <Link to="/subscriptions">Subscribe &amp; save</Link>
            </li>
            <li>
              <Link to="/contact">Store information</Link>
            </li>
          </ul>
        </div>

        {/* Help Column */}
        <div className="footer-column">
          <h4>Help</h4>
          <ul>
            <li>
              <Link to="/contact">Customer service</Link>
            </li>
            <li>
              <Link to="/contact">FAQs</Link>
            </li>
            <li>
              <Link to="/policies/returns">Returns</Link>
            </li>
            <li>
              <Link to="/policies/shipping">Shipping</Link>
            </li>
          </ul>
        </div>

        {/* About Column */}
        <div className="footer-column">
          <h4>About</h4>
          <ul>
            <li>
              <Link to="/contact">About us</Link>
            </li>
            <li>
              <Link to="/contact">Careers inquiries</Link>
            </li>
            <li>
              <Link to="/policies/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link to="/policies/terms">Terms of use</Link>
            </li>
          </ul>
        </div>

        {/* Stay Connected Column */}
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
            Social profile links are not configured yet. Use the contact page for direct support.
          </p>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <p>© 2024 Zephyr Lux. All rights reserved.</p>
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

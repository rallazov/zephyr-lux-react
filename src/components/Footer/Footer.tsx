// src/components/Footer/Footer.tsx

import { faFacebookF, faInstagram, faTwitter, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import SubscriptionForm from '../SubscriptionForm/SubscriptionForm.js';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="footer-container">
        {/* Promotions Column */}
        <div className="footer-column">
          <h4>Promotions</h4>
          <ul>
            <li><a href="#">Gift Cards</a></li>
            <li><a href="#">Stores</a></li>
            <li><a href="#">Afterpay</a></li>
          </ul>
        </div>

        {/* Help Column */}
        <div className="footer-column">
          <h4>Help</h4>
          <ul>
            <li><a href="#">Customer Service</a></li>
            <li><a href="#">FAQs</a></li>
            <li><a href="#">Returns</a></li>
          </ul>
        </div>

        {/* About Column */}
        <div className="footer-column">
          <h4>About</h4>
          <ul>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Privacy Policy</a></li>
          </ul>
        </div>

        {/* Stay Connected Column */}
        <div className="footer-column">
          <h4>Stay Connected</h4>
          <p>Subscribe to our newsletter for the latest updates.</p>
          <SubscriptionForm
            className="footer-subscription-form"
            buttonText="Subscribe"
            placeholderText="Enter your email"
            successMessage="Thank you for subscribing!"
            errorMessage="Please enter a valid email."
          />
          <div className="social-icons">
            <a href="#" aria-label="Facebook">
              <FontAwesomeIcon icon={faFacebookF} />
            </a>
            <a href="#" aria-label="Instagram">
              <FontAwesomeIcon icon={faInstagram} />
            </a>
            <a href="#" aria-label="Twitter">
              <FontAwesomeIcon icon={faTwitter} />
            </a>
            <a href="#" aria-label="YouTube">
              <FontAwesomeIcon icon={faYoutube} />
            </a>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <p>© 2024 Zephyr Lux. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;

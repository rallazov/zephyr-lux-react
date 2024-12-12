import React from 'react';
import { Link } from 'react-router-dom';
import './DiscountMessage.css';

const DiscountMessage: React.FC = () => {
  return (
    <div className="discount-message">
      <h2>LONG WEEKEND SALE</h2>
      <div className="discount-container">
        <div className="discount-item">
          <span className="discount-amount">60% OFF</span>
          <span className="discount-text">SITEWIDE</span>
        </div>
        <div className="vertical-line"></div>
        <div className="discount-item">
          <span className="discount-amount">20% OFF</span>
          <span className="discount-text">YOUR ORDER</span>
        </div>
      </div>
      <div className="cta-buttons">
        <Link to="/women" className="btn">Shop Women</Link>
        <Link to="/men" className="btn">Shop Men</Link>
      </div>
    </div>
  );
};

export default DiscountMessage;

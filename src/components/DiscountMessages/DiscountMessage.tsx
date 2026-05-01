import React from 'react';
import { Link } from 'react-router-dom';
import './DiscountMessage.css';

const DiscountMessage: React.FC = () => {
  return (
    <div className="discount-message">
      <h2>Shop the sale</h2>
      <div className="discount-container">
        <div className="discount-item discount-item-full">
          <span className="discount-text discount-headline">Select styles at special pricing</span>
          <span className="discount-sub">Pricing may vary by item—check each product for the current offer.</span>
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

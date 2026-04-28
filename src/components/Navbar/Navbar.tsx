import { faSearch, faShoppingCart, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTION_ROUTES } from '../../catalog/collections';
import { useCart } from '../../context/CartContext';
import './Navbar.css';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { cartCount } = useCart();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Set isScrolled based on scroll position (scroll up past 100px)
      if (currentScrollY > 100) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''} ${isMenuOpen ? 'active' : ''}`}>
      <div className="logo">
        <img src="/assets/logos/transparent_logo.png" alt="Zephyr Lux Logo" />
      </div>
      <span className="hamburger" onClick={toggleMenu} aria-label="Toggle navigation menu">
        <i className="fas fa-bars"></i>
      </span>
      <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        {COLLECTION_ROUTES.map((c) => (
          <li key={c.path}>
            <Link to={c.path}>{c.navLabel}</Link>
          </li>
        ))}
        <li><Link to="/">Home</Link></li>
        <li><Link to="/products">Shop</Link></li>
      </ul>
      <div className="nav-icons">
        <button
          type="button"
          className="nav-icon-btn"
          disabled
          aria-label="Search (coming soon)"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>
        <button
          type="button"
          className="nav-icon-btn"
          disabled
          aria-label="Account (coming soon)"
        >
          <FontAwesomeIcon icon={faUser} />
        </button>
        <Link to="/cart" aria-label="Cart">
          <div className="cart-container">
            <FontAwesomeIcon icon={faShoppingCart} />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </div>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

import { faSearch, faShoppingCart, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTION_ROUTES } from '../../catalog/collections';
import { useCart } from '../../context/CartContext';
import './Navbar.css';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
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
      setIsMenuOpen(false);
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeMenu = () => {
      setIsMenuOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', closeMenu, { passive: true });
    window.addEventListener('touchmove', closeMenu, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', closeMenu);
      window.removeEventListener('touchmove', closeMenu);
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav ref={navRef} className={`navbar ${isScrolled ? 'scrolled' : ''} ${isMenuOpen ? 'active' : ''}`}>
      <div className="logo">
        <img src="/assets/logos/transparent_logo.png" alt="Zephyr Lux Logo" />
      </div>
      <span
        className="hamburger"
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMenu();
          }
        }}
        aria-expanded={isMenuOpen}
        aria-label="Toggle navigation menu"
        role="button"
        tabIndex={0}
      >
        <i className="fas fa-bars"></i>
      </span>
      <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        {COLLECTION_ROUTES.map((c) => (
          <li key={c.path}>
            <Link to={c.path} onClick={() => setIsMenuOpen(false)}>{c.navLabel}</Link>
          </li>
        ))}
        <li><Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
        <li><Link to="/products" onClick={() => setIsMenuOpen(false)}>Shop</Link></li>
      </ul>
      <div className="nav-icons">
        <Link
          to="/search"
          className="nav-icon-btn"
          aria-label="Search products"
          onClick={() => setIsMenuOpen(false)}
        >
          <FontAwesomeIcon icon={faSearch} />
        </Link>
        <Link
          to="/account"
          className="nav-icon-btn"
          aria-label="Account"
          onClick={() => setIsMenuOpen(false)}
        >
          <FontAwesomeIcon icon={faUser} />
        </Link>
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

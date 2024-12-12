import { faSearch, faShoppingCart, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css'; // Ensure this path is correct

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

   const toggleMenu = ()=> {
    setIsMenuOpen(!isMenuOpen);
   };
   
  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''} ${isMenuOpen ? 'active' : ''}`}>
      <div className="logo">
        <img src="/src/assets/logos/transparent_logo.png" alt="Zephyr Lux Logo" />
      </div>
      <span className="hamburger" onClick={toggleMenu}>
        <i className="fas fa-bars"></i>
      </span>
      <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        <li><Link to="/women">Women</Link></li>
        <li><Link to="/men">Men</Link></li>
        <li><Link to="/underwear">Underwear</Link></li>
        <li><Link to="/kids">Kids</Link></li>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/sale">Sale</Link></li>
      </ul>
      <div className="nav-icons">
        <Link to="#"><FontAwesomeIcon icon={faSearch} /></Link>
        <Link to="#"><FontAwesomeIcon icon={faUser} /></Link>
        <Link to="#"><FontAwesomeIcon icon={faShoppingCart} /></Link>
      </div>
    </nav>
  );
};

export default Navbar;

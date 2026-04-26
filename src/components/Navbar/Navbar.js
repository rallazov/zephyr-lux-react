import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { faSearch, faShoppingCart, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import './Navbar.css';
const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { cartCount } = useCart();
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            // Set isScrolled based on scroll position (scroll up past 100px)
            if (currentScrollY > 100) {
                setIsScrolled(true);
            }
            else {
                setIsScrolled(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };
    return (_jsxs("nav", { className: `navbar ${isScrolled ? 'scrolled' : ''} ${isMenuOpen ? 'active' : ''}`, children: [_jsx("div", { className: "logo", children: _jsx("img", { src: "/assets/logos/transparent_logo.png", alt: "Zephyr Lux Logo" }) }), _jsx("span", { className: "hamburger", onClick: toggleMenu, "aria-label": "Toggle navigation menu", children: _jsx("i", { className: "fas fa-bars" }) }), _jsxs("ul", { className: `nav-links ${isMenuOpen ? 'open' : ''}`, children: [_jsx("li", { children: _jsx(Link, { to: "/women", children: "Women" }) }), _jsx("li", { children: _jsx(Link, { to: "/men", children: "Men" }) }), _jsx("li", { children: _jsx(Link, { to: "/underwear", children: "Underwear" }) }), _jsx("li", { children: _jsx(Link, { to: "/kids", children: "Kids" }) }), _jsx("li", { children: _jsx(Link, { to: "/", children: "Home" }) }), _jsx("li", { children: _jsx(Link, { to: "/sale", children: "Sale" }) })] }), _jsxs("div", { className: "nav-icons", children: [_jsx(Link, { to: "#", "aria-label": "Search", children: _jsx(FontAwesomeIcon, { icon: faSearch }) }), _jsx(Link, { to: "#", "aria-label": "Account", children: _jsx(FontAwesomeIcon, { icon: faUser }) }), _jsx(Link, { to: "/cart", "aria-label": "Cart", children: _jsxs("div", { className: "cart-container", children: [_jsx(FontAwesomeIcon, { icon: faShoppingCart }), cartCount > 0 && (_jsx("span", { className: "cart-count", children: cartCount }) // Display count only if > 0
                                )] }) })] })] }));
};
export default Navbar;

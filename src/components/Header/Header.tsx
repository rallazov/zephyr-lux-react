import React from "react";
import { Link, useLocation } from "react-router-dom";

interface HeaderProps {
  cartItemCount?: number;
}

export default function Header({ cartItemCount = 0 }: HeaderProps) {
  const location = useLocation();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Shop" },
    { href: "/about", label: "About" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-gray-900">ZEPHYR <span className="text-indigo-600">LUX</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <span className={`text-sm font-medium transition-colors hover:text-indigo-600 ${location.pathname === link.href ? "text-gray-900" : "text-gray-500"}`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/cart">
              <button className="relative inline-flex items-center p-2 rounded-md hover:bg-gray-100">
                <span className="sr-only">Open cart</span>
                🛒
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-xs">{cartItemCount}</span>
                )}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

import Navbar from '../Navbar/Navbar'; // Adjust the path accordingly
import './Header.css';


const Header: React.FC = () => {

  return (
    <header >
      <Navbar />  {/* Add Navbar here */}
    </header>
  );
}

export default Header;

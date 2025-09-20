import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Users } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'Resources', href: '/resources' },
    { name: 'Testimonials', href: '/testimonials' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">The Huddle Co.</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`font-medium transition-colors duration-200 ${
                  isActive(item.href)
                    ? 'text-orange-500 border-b-2 border-orange-500'
                    : 'text-gray-600 hover:text-orange-500'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/lms/login"
              className="text-gray-600 hover:text-orange-500 font-medium transition-colors duration-200"
            >
              Client Login
            </Link>
            <Link
              to="/admin/login"
              className="text-gray-600 hover:text-orange-500 font-medium transition-colors duration-200 text-sm"
            >
              Admin
            </Link>
            <a
              href="#book-call"
              className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-2 rounded-full font-medium hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105"
            >
              Book Discovery Call
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <Menu className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`font-medium px-4 py-2 rounded-lg transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-orange-500 bg-orange-50'
                      : 'text-gray-600 hover:text-orange-500 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="px-4 pt-4 border-t border-gray-200">
                <Link
                  to="/lms/login"
                  className="block text-gray-600 hover:text-orange-500 font-medium mb-3"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Client Login
                </Link>
                <Link
                  to="/admin/login"
                  className="block text-gray-600 hover:text-orange-500 font-medium mb-3 text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin Portal
                </Link>
                <a
                  href="#book-call"
                  className="block text-center bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-3 rounded-full font-medium hover:from-orange-500 hover:to-red-600 transition-all duration-200"
                >
                  Book Discovery Call
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
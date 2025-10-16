import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

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
    <header className="sticky top-0 z-50 bg-surface shadow-card border-b border-border/50 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-primary to-secondary p-2 rounded-lg shadow-card">
              <Users className="h-6 w-6 text-white" />
            </div>
            <span className="font-heading text-xl font-semibold text-foreground">The Huddle Co.</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6" role="navigation" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`font-medium transition-colors duration-brand focus:outline-none focus-visible:shadow-focus rounded-lg px-2 py-1 ${
                  isActive(item.href)
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted hover:text-primary'
                }`}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/lms/login"
              className="text-muted hover:text-primary font-medium transition-colors duration-brand"
            >
              Client Login
            </Link>
            <Link
              to="/admin/login"
              className="text-muted hover:text-primary font-medium transition-colors duration-brand text-sm"
            >
              Admin
            </Link>
            <a
              href="#book-call"
              className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-2 rounded-full font-medium shadow-card hover:shadow-lg transition-transform duration-brand hover:scale-105"
            >
              Book Discovery Call
            </a>
            <ThemeToggle />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-lg p-2 text-muted hover:text-primary focus:outline-none focus-visible:shadow-focus"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border-subtle bg-surface">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`font-medium px-4 py-2 rounded-lg transition-colors duration-brand ${
                    isActive(item.href)
                      ? 'text-primary bg-primary-soft'
                      : 'text-muted hover:text-primary hover:bg-surface-subtle'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="px-4 pt-4 border-t border-border-subtle space-y-3">
                <Link
                  to="/lms/login"
                  className="block text-muted hover:text-primary font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Client Login
                </Link>
                <Link
                  to="/admin/login"
                  className="block text-muted hover:text-primary font-medium text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin Portal
                </Link>
                <a
                  href="#book-call"
                  className="block text-center bg-gradient-to-r from-primary to-secondary text-white px-6 py-3 rounded-full font-medium shadow-card hover:shadow-lg transition-transform duration-brand hover:scale-105"
                >
                  Book Discovery Call
                </a>
                <div className="flex justify-center pt-3">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
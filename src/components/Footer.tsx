import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Mail, Phone, MapPin, Linkedin, Twitter, Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-inverse-surface text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-gradient-to-r from-primary to-secondary p-2 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <span className="font-heading text-xl font-semibold text-inverse-foreground">The Huddle Co.</span>
            </div>
            <p className="text-inverse-foreground/80 mb-4 max-w-md">
              We help organizations lead with empathy, build inclusive cultures, and hold space for courageous conversations.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-inverse-foreground/70 hover:text-primary transition-colors duration-brand">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-inverse-foreground/70 hover:text-primary transition-colors duration-brand">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-inverse-foreground/70 hover:text-primary transition-colors duration-brand">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-inverse-foreground/80 hover:text-primary transition-colors duration-brand">About Us</Link></li>
              <li><Link to="/services" className="text-inverse-foreground/80 hover:text-primary transition-colors duration-brand">Services</Link></li>
              <li><Link to="/resources" className="text-inverse-foreground/80 hover:text-primary transition-colors duration-brand">Free Resources</Link></li>
              <li><Link to="/testimonials" className="text-inverse-foreground/80 hover:text-primary transition-colors duration-brand">Testimonials</Link></li>
              <li><Link to="/client-portal" className="text-inverse-foreground/80 hover:text-primary transition-colors duration-brand">Client Portal</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Get In Touch</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-inverse-foreground/80">hello@thehuddleco.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-inverse-foreground/80">(555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-inverse-foreground/80">Nationwide</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center">
          <p className="text-inverse-foreground/70">&copy; 2025 The Huddle Co. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
import { Linkedin, Twitter } from 'lucide-react';

const footerLinks = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Access Statement', href: '/accessibility' },
];

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-mist/60 bg-softwhite">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <a href="/" aria-label="Return to home" className="flex items-center gap-3 no-underline">
          <img src="/logo.svg" alt="Huddle Co." className="h-12 w-12 rounded-2xl shadow-card-sm" />
        </a>

        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate/80">
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href} className="hover:text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mist text-slate/80 transition hover:text-sunrise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
          >
            <Linkedin className="h-5 w-5" aria-hidden="true" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mist text-slate/80 transition hover:text-sunrise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
          >
            <Twitter className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="border-t border-mist/40 bg-white/70">
        <p className="mx-auto max-w-7xl px-6 py-4 text-sm text-slate/70 lg:px-12">
          &copy; {new Date().getFullYear()} The Huddle Co. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;

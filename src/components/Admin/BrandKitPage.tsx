import React from 'react';
import { LazyImage } from '../PerformanceComponents';

type ColorSwatch = { name: string; value: string; usage: string; token: string };

const brandColors: ColorSwatch[] = [
  { name: 'Sunrise Orange', value: '#de7b12', usage: 'Primary CTAs + warm gradients', token: '--hud-orange' },
  { name: 'Deep Red', value: '#D72638', usage: 'Destructive + alert states', token: '--hud-red' },
  { name: 'Sky Blue', value: '#3A7DFF', usage: 'Links, progress, info', token: '--hud-blue' },
  { name: 'Forest Green', value: '#228B22', usage: 'Success & positive signals', token: '--hud-green' },
  { name: 'Dark Navy', value: '#1E1E22', usage: 'Dark overlays + cards', token: '--hud-navy' },
  { name: 'Ink', value: '#222222', usage: 'Primary body + heading text', token: '--hud-ink' }
];

const neutralSwatches: ColorSwatch[] = [
  { name: 'Soft Background', value: '#FFFDF9', usage: 'Global page background', token: '--hud-bg' },
  { name: 'Cloud Surface', value: '#F4F5F7', usage: 'Cards + panels', token: '--color-cloud' },
  { name: 'Mist Border', value: '#E4E7EB', usage: 'Dividers + outlines', token: '--color-mist' },
  { name: 'Slate Text', value: '#3F3F3F', usage: 'Muted paragraphs', token: '--color-slate' },
  { name: 'Gold Accent', value: '#F6C87B', usage: 'Highlights + celebration badges', token: '--color-gold' }
];

const gradientTokens = [
  { name: 'Sunrise CTA', token: '--gradient-orange-red', usage: 'Primary CTAs, hero buttons' },
  { name: 'Sky Path', token: '--gradient-blue-green', usage: 'Progress meters, onboarding moments' },
  { name: 'Brand Spectrum', token: '--gradient-brand', usage: 'Section backplates, feature banners' },
  { name: 'Card Glow', token: '--gradient-card', usage: 'Info cards + subtle glows' },
  { name: 'Pill Highlight', token: '--gradient-pill', usage: 'Badge pills + counters' }
];

const brandFonts = [
  { name: 'Inter', usage: 'Primary UI + paragraphs' },
  { name: 'Montserrat', usage: 'Hero & display headings' },
  { name: 'Lato', usage: 'Long-form supporting copy' },
  { name: 'Quicksand', usage: 'Playful stats & highlights' }
];

const brandIcons = [
  { name: 'Lucide', usage: 'UI Icons (stroke-based, responsive)' },
  { name: 'Custom', usage: 'Huddle logo marks & illustrations' }
];

const componentTokens = [
  {
    title: 'Toasts',
    description: 'Use <Toast /> or the `.hud-toast` helper. Swap tone with `data-tone="success|info|warning|error"`.',
    code: `<div class="hud-toast" data-tone="success">
  ...toast content...
</div>`
  },
  {
    title: 'Badges',
    description: 'Use `.badge` with `data-tone` or the preset classes (.badge-success, etc.) for compact labels.',
    code: `<span class="badge" data-tone="warning">Pending</span>`
  }
];

const BrandKitPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-mutedgrey">Huddle Co.</p>
        <h1 className="text-3xl font-heading font-bold">Brand Kit</h1>
        <p className="text-mutedgrey">Unified palette, gradients, typography, and component tokens so product + marketing stay in lockstep.</p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Core Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {brandColors.map(color => (
            <div key={color.name} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl shadow-card mb-2" style={{ background: color.value }} />
              <span className="font-medium">{color.name}</span>
              <span className="text-xs text-mutedgrey uppercase tracking-wide">{color.value}</span>
              <span className="text-xs text-mutedgrey mt-1">
                {color.usage}
                <br />
                <code className="text-[10px]">{color.token}</code>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Neutrals & Surfaces</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {neutralSwatches.map(color => (
            <div key={color.name} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-xl border border-mutedgrey/40" style={{ background: color.value }} />
              <span className="text-sm font-medium mt-2">{color.name}</span>
              <span className="text-xs text-mutedgrey">{color.usage}</span>
              <span className="text-[10px] text-mutedgrey uppercase tracking-wide mt-1">{color.token}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Gradients & Glow</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {gradientTokens.map(gradient => (
            <div
              key={gradient.token}
              className="rounded-2xl p-4 text-white shadow-card border border-white/10"
              style={{ backgroundImage: `var(${gradient.token})` }}
            >
              <p className="text-sm uppercase tracking-widest text-white/70">{gradient.token}</p>
              <p className="text-lg font-semibold">{gradient.name}</p>
              <p className="text-sm text-white/80">{gradient.usage}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Typography</h2>
        <div className="grid grid-cols-2 gap-6">
          {brandFonts.map(font => (
            <div key={font.name} className="flex flex-col items-start">
              <span className="font-heading text-lg mb-1">{font.name}</span>
              <span className="text-sm text-mutedgrey">{font.usage}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Icons</h2>
        <div className="grid grid-cols-2 gap-6">
          {brandIcons.map(icon => (
            <div key={icon.name} className="flex flex-col items-start">
              <span className="font-heading text-lg mb-1">{icon.name}</span>
              <span className="text-sm text-mutedgrey">{icon.usage}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Logo</h2>
        <div className="flex items-center gap-6">
          <LazyImage
            src="/logo192.png"
            webpSrc="/logo192.webp"
            avifSrc="/logo192.avif"
            srcSet="/logo192.png 1x, /logo192@2x.png 2x"
            sizes="80px"
            alt="The Huddle Co. Logo"
            className="h-20 w-20 rounded-full border shadow-lg"
            fallbackSrc="/default-org-fallback.png"
            placeholder={<div className="w-20 h-20 rounded-full bg-mutedgrey animate-pulse" />}
          />
          <a href="/logo192.png" download className="px-4 py-2 rounded-xl font-heading transition-colors btn-cta">
            Download Logo
          </a>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Component Tokens</h2>
          <p className="text-mutedgrey mb-4">
            Toasts and badges are now token-driven. Lean on the helpers below so tones stay synced with the palette.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {componentTokens.map(token => (
              <div key={token.title} className="p-4 rounded-2xl border border-mutedgrey/40 bg-softwhite/60">
                <p className="text-sm uppercase tracking-[0.3em] text-mutedgrey">{token.title}</p>
                <h3 className="text-lg font-semibold mb-2">{token.description}</h3>
                <pre className="bg-charcoal text-softwhite text-xs rounded-xl p-3 overflow-auto">
                  <code>{token.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Usage Guidelines</h2>
          <ul className="list-disc pl-6 text-mutedgrey space-y-2">
            <li>Reach for CSS variables (e.g. <code>var(--gradient-pill)</code>) before hard-coding new hex values.</li>
            <li>Combine <code>.hud-toast</code> + <code>data-tone</code> for alerts so the border, icon, and copy stay on palette.</li>
            <li>Use <code>.badge</code> with either <code>data-tone</code> or the preset classes to keep micro-labels consistent.</li>
            <li>Typography stack: Inter for product UI, Montserrat for hero displays, Lato/Quicksand for long-form and accents.</li>
            <li>Run <code>npx ts-node scripts/design-consistency-checker.ts</code> before releases to flag off-brand colors/fonts.</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default BrandKitPage;

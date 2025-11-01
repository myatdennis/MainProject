import React from 'react';

const brandColors = [
  { name: 'Sunrise Orange', value: '#F28C1A' },
  { name: 'Deep Red', value: '#E6473A' },
  { name: 'Sky Blue', value: '#2B84C6' },
  { name: 'Forest Green', value: '#3BAA66' },
  { name: 'Charcoal Block', value: '#1E1E1E' },
  { name: 'Soft White', value: '#F9F9F1' }
];

const brandFonts = [
  { name: 'Montserrat', usage: 'Headings & display' },
  { name: 'Lato', usage: 'Body copy' },
  { name: 'Quicksand', usage: 'Highlights & supporting labels' }
];

const brandIcons = [
  { name: 'Lucide', usage: 'UI Icons' },
  { name: 'Custom', usage: 'Brand/Logo' }
];

const BrandKitPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-heading font-bold mb-6">Brand Kit</h1>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {brandColors.map(color => (
            <div key={color.name} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full shadow-lg mb-2" style={{ background: color.value }} />
              <span className="font-medium">{color.name}</span>
              <span className="text-xs text-mutedgrey uppercase tracking-wide">{color.value}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
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
      <section className="mb-8">
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
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Logo</h2>
        <div className="flex items-center space-x-6">
          <img src="/logo192.png" alt="The Huddle Co. Logo" className="h-20 w-20 rounded-full border shadow-lg" />
          <a href="/logo192.png" download className="px-4 py-2 bg-sunrise text-white rounded-xl font-heading hover:bg-sunrise/90 transition-colors">Download Logo</a>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Usage Guidelines</h2>
        <ul className="list-disc pl-6 text-mutedgrey">
          <li>Use brand colors for primary actions, backgrounds, and highlights.</li>
          <li>Headings use Montserrat, body copy leans on Lato, with Quicksand for accents.</li>
          <li>Icons should be consistent and accessible.</li>
          <li>Logo must be clear and not distorted.</li>
        </ul>
      </section>
    </div>
  );
};

export default BrandKitPage;

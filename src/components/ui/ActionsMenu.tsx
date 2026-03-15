import React, { useEffect, useRef, useState } from 'react';

export type ActionsMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type ActionsMenuProps = {
  items: ActionsMenuItem[];
  ariaLabel?: string;
  className?: string;
};

const ActionsMenu: React.FC<ActionsMenuProps> = ({ items, ariaLabel = 'Actions', className }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // focus first enabled item
      const firstIndex = items.findIndex((it) => !it.disabled);
      if (firstIndex >= 0) buttonsRef.current[firstIndex]?.focus();
    }
  }, [open, items]);

  const onToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={className ?? 'relative inline-block text-left'}>
      <button
        ref={toggleRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onToggleKeyDown}
        className="p-2 rounded-md text-gray-600 hover:bg-gray-50"
        title={ariaLabel}
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-md border border-gray-100 bg-white shadow-lg">
          <div className="py-1" role="menu" aria-label={ariaLabel}>
            {items.map((it, idx) => (
              <button
                key={it.key}
                ref={(el) => (buttonsRef.current[idx] = el)}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`w-full text-left px-3 py-2 text-sm ${it.destructive ? 'text-rose-600' : ''} ${it.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsMenu;

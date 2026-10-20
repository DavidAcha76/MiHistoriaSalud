import { useEffect } from 'react';
import { colors } from '../theme/colors';

export function WebAccessibility() {
  useEffect(() => {
    document.documentElement.lang = 'es';
    const style = document.createElement('style');
    style.textContent = `
      :root { color-scheme: dark; background: ${colors.background}; }
      body { background: ${colors.background}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      ::selection { background: rgba(121, 221, 202, 0.35); color: ${colors.text}; }
      :focus-visible { outline: 3px solid ${colors.primary} !important; outline-offset: 4px; }
      [data-clinia-field]:focus-visible { outline: none !important; }
      input, textarea { scroll-margin-block: 100px; }
      input::placeholder, textarea::placeholder { opacity: 1; }
      [role="button"], [role="tab"], [role="checkbox"] { transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease, opacity .16s ease; }
      * { scrollbar-width: thin; scrollbar-color: ${colors.border} transparent; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${colors.borderSoft}; border-radius: 10px; border: 2px solid ${colors.background}; }
      ::-webkit-scrollbar-thumb:hover { background: ${colors.border}; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}

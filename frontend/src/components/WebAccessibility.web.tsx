import { useEffect } from 'react';
import { colors } from '../theme/colors';

export function WebAccessibility() {
  useEffect(() => {
    document.documentElement.lang = 'es';
    const style = document.createElement('style');
    style.textContent = `
      :root { color-scheme: dark; background: ${colors.background}; }
      body { background: ${colors.background}; }
      :focus-visible { outline: 3px solid ${colors.primary} !important; outline-offset: 4px; }
      input, textarea { scroll-margin-block: 100px; }
      input::placeholder, textarea::placeholder { opacity: 1; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}

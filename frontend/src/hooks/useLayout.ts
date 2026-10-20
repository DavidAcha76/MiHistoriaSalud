import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_BREAKPOINT = 1100;
const CONTENT_MAX = 1120;
const FORM_MAX = 760;

/** Indica si la pantalla se muestra junto al menú lateral (pestañas principales). */
export const InTabsContext = createContext(false);

/** Medidas compartidas para que menú, pantallas y columnas cambien en los mismos puntos. */
export function useLayout(form = false) {
  const { width, height, fontScale } = useWindowDimensions();
  const inTabs = useContext(InTabsContext);
  const largeText = fontScale >= 1.4;
  const sidebarMode = width >= SIDEBAR_BREAKPOINT && !largeText;
  const padding = width >= 768 ? 36 : 16;
  const available = sidebarMode && inTabs ? width - SIDEBAR_WIDTH : width;
  const contentWidth = Math.max(0, Math.min(available, form ? FORM_MAX : CONTENT_MAX) - padding * 2);
  return { width, height, fontScale, largeText, sidebarMode, padding, contentWidth, compact: width < 400, twoColumns: !largeText && contentWidth >= 640 };
}

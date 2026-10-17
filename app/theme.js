// Shared colours and sizes, so every screen looks the same.
import { useWindowDimensions } from "react-native";

// Phone layout below 900px wide; desktop layout (columns, max 1200px wide) above it.
export function useLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pad = wide ? 32 : 16;
  const content = Math.min(width, 1200) - 2 * pad;   // usable width inside the page padding
  const fullChart = content - 34;                     // a chart inside a full-width card
  const halfChart = (content - 16) / 2 - 34;          // a chart inside a half-width card
  return { wide, pad, content, fullChart, halfChart };
}

export const C = {
  page: "#f3f5f9",       // screen background
  card: "#ffffff",       // cards
  line: "#e2e7ef",       // card borders and dividers
  ink: "#1b2533",        // main text
  muted: "#5b6779",      // secondary text
  faint: "#8a95a6",      // captions
  primary: "#2457d6",    // buttons, selected options
  primarySoft: "#e8eefc",
  good: "#1a7f4b",       // Sustainable, advice
  goodSoft: "#e6f4ec",
  danger: "#c0392b",     // alerts, stress tests
  dangerSoft: "#fbe9e7",
};

export const BAND_COLOURS = {
  Sustainable: "#1a7f4b",
  Caution: "#b8860b",
  Warning: "#d2691e",
  "Death Spiral": "#c0392b",
};

export const R = { card: 16, button: 12, chip: 20 };

export const card = {
  backgroundColor: C.card,
  borderRadius: R.card,
  borderWidth: 1,
  borderColor: C.line,
  padding: 16,
  marginBottom: 14,
};

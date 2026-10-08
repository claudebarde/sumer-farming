// Schematic southern Mesopotamia: positions are for legibility, not surveying.
// Reference: https://en.wikipedia.org/wiki/Sumer (principal cities map).
export const SUMER_CITIES = [
  { id: "nippur", name: "Nippur", x: 0.40, y: 0.15 },
  { id: "adab", name: "Adab", x: 0.54, y: 0.29 },
  { id: "shuruppak", name: "Shuruppak", x: 0.36, y: 0.39 },
  { id: "umma", name: "Umma", x: 0.58, y: 0.49 },
  { id: "uruk", name: "Uruk", x: 0.32, y: 0.60 },
  { id: "lagash", name: "Lagash", x: 0.76, y: 0.60 },
  { id: "ur", name: "Ur", x: 0.48, y: 0.79 },
  { id: "eridu", name: "Eridu", x: 0.32, y: 0.90 }
] as const;
export type SumerCityId = typeof SUMER_CITIES[number]["id"];
export const sumerMapFrame = (width: number, height: number) => {
  const scale = Math.max(0.1, Math.min((width - 40) / 900, (height - 230) / 650));
  return { x: (width - 900 * scale) / 2, y: 85, width: 900 * scale, height: 650 * scale };
};

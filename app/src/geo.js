// Coordinates for every town/hub that appears in connection.csv. The CSV is the
// single source of truth for the data; coordinates are the one technical lookup
// kept here (city names aren't geocodable in the browser). Keyed by the
// normalized city name (see cityKey). Add an entry when a new place appears.

export const GEO = {
  // participant towns
  Millbrook: { lat: 44.15, lng: -78.448, country: "Canada" },
  Montreal: { lat: 45.5019, lng: -73.5674, country: "Canada" },
  Victoria: { lat: 48.4284, lng: -123.3656, country: "Canada" },
  "Los Angeles": { lat: 34.0522, lng: -118.2437, country: "United States" },
  Stuttgart: { lat: 48.7758, lng: 9.1829, country: "Germany" },
  Descartes: { lat: 46.9736, lng: 0.7003, country: "France" },
  Singapore: { lat: 1.3521, lng: 103.8198, country: "Singapore" },
  Sukagawa: { lat: 37.2864, lng: 140.3728, country: "Japan" },
  Melbourne: { lat: -37.8136, lng: 144.9631, country: "Australia" },
  "San Jose": { lat: 9.9281, lng: -84.0907, country: "Costa Rica" },
  Miami: { lat: 25.7617, lng: -80.1918, country: "United States" },
  "Kansas City": { lat: 39.0997, lng: -94.5786, country: "United States" },
  Cadiz: { lat: 36.5271, lng: -6.2886, country: "Spain" },
  Hobart: { lat: -42.8821, lng: 147.3272, country: "Australia" },
  Romsey: { lat: -37.351, lng: 144.742, country: "Australia" },
  Smoline: { lat: 48.626, lng: 30.606, country: "Ukraine" },
  Lviv: { lat: 49.8397, lng: 24.0297, country: "Ukraine" },
};

// Normalize a raw city string to a GEO key: drop "(Province)" and anything after
// a comma. "Millbrook (ON)" → "Millbrook"; "Hobart, Tasmania" → "Hobart".
export function cityKey(raw) {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();
}

export function coordsOf(raw) {
  return GEO[cityKey(raw)] || null;
}

export function isUkraine(raw) {
  const g = coordsOf(raw);
  return !!g && g.country === "Ukraine";
}

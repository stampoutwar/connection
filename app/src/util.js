// Shared helpers.

// Just the town/city name — drop any "(Province)" and anything after a comma
// (state, island, region) and any country. "Millbrook (ON)" → "Millbrook",
// "Hobart, Tasmania" → "Hobart", "Sukagawa (Fukushima)" → "Sukagawa".
export function cityShort(city) {
  if (!city) return "";
  return city.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();
}

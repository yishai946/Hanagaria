// City lookup for the profile: OpenStreetMap Nominatim (free, no key). Keep requests sparse (debounced, user-initiated).
const BASE = 'https://nominatim.openstreetmap.org';

interface Hit { name?: string; display_name?: string; address?: Record<string, string> }

const cityOf = (h: Hit) => {
  const a = h.address ?? {};
  return a.city || a.town || a.village || a.municipality || a.suburb || h.name || '';
};

export interface Suggestion { city: string; detail: string }

export async function searchCities(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=il&accept-language=he&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('חיפוש הערים לא זמין כרגע');
  const hits = (await res.json()) as Hit[];
  const seen = new Set<string>();
  return hits.flatMap((h) => {
    const city = cityOf(h);
    if (!city || seen.has(city)) return [];
    seen.add(city);
    return [{ city, detail: h.address?.state || h.address?.county || '' }];
  });
}

/** The city around the browser's current position (asks the user for permission). */
export async function currentCity(): Promise<string> {
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }) : reject(new Error('unsupported')));
  const { latitude, longitude } = pos.coords;
  const res = await fetch(`${BASE}/reverse?format=jsonv2&zoom=10&accept-language=he&lat=${latitude}&lon=${longitude}`);
  if (!res.ok) throw new Error('lookup failed');
  const city = cityOf((await res.json()) as Hit);
  if (!city) throw new Error('no city');
  return city;
}

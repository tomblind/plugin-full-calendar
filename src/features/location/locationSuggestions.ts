/**
 * @file locationSuggestions.ts
 * @brief Suggestions for the event editor's location box.
 *
 * @description
 * Two sources: locations already used by events in the cache, and an online
 * address search through Photon (https://photon.komoot.io), an OpenStreetMap
 * search service that allows search-as-you-type and needs no API key.
 *
 * @license See LICENSE.md
 */

import { requestUrl } from 'obsidian';

const PHOTON_URL = 'https://photon.komoot.io/api/';

/** Fewest characters typed before an online search is sent. */
export const MIN_ONLINE_QUERY_LENGTH = 3;

/**
 * Past locations that contain every word of `query` (ignoring case), with
 * locations that start with the query listed first. An empty query returns
 * the first `limit` locations unchanged.
 */
export function matchPastLocations(locations: string[], query: string, limit = 5): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return locations.slice(0, limit);
  }
  const words = q.split(/\s+/);
  const matches = locations.filter(loc => {
    const lower = loc.toLowerCase();
    return lower !== q && words.every(w => lower.includes(w));
  });
  const starts = matches.filter(loc => loc.toLowerCase().startsWith(q));
  const rest = matches.filter(loc => !loc.toLowerCase().startsWith(q));
  return [...starts, ...rest].slice(0, limit);
}

export interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface PhotonResponse {
  features?: { properties?: PhotonProperties }[];
}

/**
 * Builds a one-line address such as
 * "Red Rocks Amphitheatre, 18300 West Alameda Parkway, Morrison, Colorado 80465, United States".
 * Returns null when the result has nothing usable.
 */
export function formatPhotonPlace(p: PhotonProperties): string | null {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const region = [p.state, p.postcode].filter(Boolean).join(' ');
  const parts = [p.name, street, p.city || p.district || p.county, region, p.country].filter(
    (part): part is string => Boolean(part)
  );
  // Photon sometimes repeats the same text in name and street or city.
  const unique = parts.filter((part, i) => parts.indexOf(part) === i);
  return unique.length > 0 ? unique.join(', ') : null;
}

export interface PlaceSearchBias {
  latitude: number;
  longitude: number;
}

/**
 * Searches Photon for places matching `query`. Results near `bias` rank
 * higher when it is given. Returns an empty list for short queries or when
 * the request fails.
 */
export async function searchPlaces(
  query: string,
  bias?: PlaceSearchBias | null,
  limit = 5
): Promise<string[]> {
  const q = query.trim();
  if (q.length < MIN_ONLINE_QUERY_LENGTH) {
    return [];
  }
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (bias) {
    params.set('lat', String(bias.latitude));
    params.set('lon', String(bias.longitude));
  }
  try {
    const response = await requestUrl({ url: `${PHOTON_URL}?${params.toString()}` });
    const data = response.json as PhotonResponse;
    const places = (data.features ?? [])
      .map(f => (f.properties ? formatPhotonPlace(f.properties) : null))
      .filter((place): place is string => Boolean(place));
    return places.filter((place, i) => places.indexOf(place) === i);
  } catch (e) {
    console.warn('Full Calendar: location search failed', e);
    return [];
  }
}

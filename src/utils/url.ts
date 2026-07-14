/**
 * @file url.ts
 * @brief Small helpers for detecting URLs in free-text fields.
 *
 * @description
 * Some calendar events stash a meeting link in the `location` field rather than a
 * dedicated conference field. These helpers let the UI detect that case and offer
 * a "go to link" affordance.
 *
 * @license See LICENSE.md
 */

/**
 * Returns true if the given string is an http(s) URL.
 *
 * Mirrors the `startsWith('http')` convention already used by the ICS provider,
 * but validates with the URL parser to avoid false positives like "http building".
 */
export function isHttpUrl(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

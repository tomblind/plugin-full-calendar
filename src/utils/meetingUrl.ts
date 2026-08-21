import * as React from 'react';

/**
 * Injects a meeting URL into location or description.
 * If location is empty, it assigns the meeting URL to location.
 * Otherwise, it appends the meeting URL to the description.
 */
export function injectMeetingUrl(
  meetingUrl: string,
  location: string | undefined,
  description: string | undefined
): { location: string; description: string } {
  const currentLoc = (location || '').trim();
  const currentDesc = (description || '').trim();

  if (!currentLoc) {
    return {
      location: meetingUrl,
      description: currentDesc
    };
  }

  const suffix = `meeting URL: ${meetingUrl}`;
  const newDesc = currentDesc ? `${currentDesc}\n\n${suffix}` : suffix;
  return {
    location: currentLoc,
    description: newDesc
  };
}

/**
 * Splits text by URL patterns and returns a mix of strings and clickable React <a> elements.
 */
export function linkify(text: string): React.ReactNode {
  if (!text) return '';
  const urlRegex = /(https?:\/\/\S+)/g;
  const parts = text.split(urlRegex);
  return parts
    .map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return React.createElement(
          'a',
          {
            key: index,
            href: part,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'event-link'
          },
          part
        );
      }
      return part;
    })
    .filter(part => part !== '');
}

/**
 * Extracts an openable http(s) URL from an event's `location` field.
 *
 * Locations often hold a bare meeting link ("https://meet.google.com/abc-def"),
 * or a link embedded in prose ("Zoom: https://zoom.us/j/123 (passcode 4321)").
 * Returns the first http(s) URL found, or null when the location holds none.
 */
export function extractLocationUrl(location: string | undefined | null): string | null {
  if (!location) return null;

  const match = location.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;

  // Trim trailing punctuation picked up from surrounding prose. A closing paren
  // is only trimmed when the URL itself has no opening paren to match it.
  let url = match[0].replace(/[.,;:!?'"\]}>]+$/, '');
  while (url.endsWith(')') && !url.includes('(')) {
    url = url.slice(0, -1);
  }

  try {
    const parsed = new URL(url);
    // A hostname is required — "https://" alone parses but is not openable.
    return parsed.hostname ? url : null;
  } catch {
    return null;
  }
}

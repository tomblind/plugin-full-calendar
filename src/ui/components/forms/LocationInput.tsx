/**
 * @file LocationInput.tsx
 * @brief Location text box with a suggestion list.
 *
 * @description
 * While the user types, the list shows matching locations from existing
 * events, then online address results from `searchPlaces` when it is given.
 * Arrow keys move through the list, Enter picks, and Escape closes it.
 *
 * @license See LICENSE.md
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../features/i18n/i18n';
import {
  matchPastLocations,
  MIN_ONLINE_QUERY_LENGTH
} from '../../../features/location/locationSuggestions';

/** Wait this long after the last keystroke before searching online. */
const ONLINE_SEARCH_DELAY_MS = 350;

interface LocationInputProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  pastLocations: string[];
  searchPlaces?: (query: string) => Promise<string[]>;
}

export const LocationInput = ({
  value,
  onChange,
  placeholder,
  pastLocations,
  searchPlaces
}: LocationInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [places, setPlaces] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  // Only the newest online search may update the list.
  const searchId = useRef(0);

  const query = value.trim();
  const canSearchOnline = Boolean(searchPlaces) && query.length >= MIN_ONLINE_QUERY_LENGTH;

  useEffect(() => {
    const id = ++searchId.current;
    if (!isOpen || !searchPlaces || !canSearchOnline) {
      setPlaces([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchPlaces(query).then(results => {
        if (id !== searchId.current) return;
        setPlaces(results);
        setSearching(false);
      });
    }, ONLINE_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, isOpen, searchPlaces, canSearchOnline]);

  const pastMatches = matchPastLocations(pastLocations, value);
  const lowerPast = new Set(pastMatches.map(p => p.toLowerCase()));
  const placeMatches = places.filter(
    p => !lowerPast.has(p.toLowerCase()) && p.toLowerCase() !== query.toLowerCase()
  );
  const items = [...pastMatches, ...placeMatches];
  const showList = isOpen && (items.length > 0 || (canSearchOnline && searching));

  const choose = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showList) {
        setIsOpen(true);
        return;
      }
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlighted(h => (items.length === 0 ? -1 : (h + step + items.length) % items.length));
    } else if (e.key === 'Enter' && showList && highlighted >= 0 && highlighted < items.length) {
      // Pick the suggestion instead of submitting the form.
      e.preventDefault();
      choose(items[highlighted]);
    } else if (e.key === 'Escape' && showList) {
      // Close the list without closing the modal.
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setHighlighted(-1);
    }
  };

  const renderItem = (item: string, index: number) => (
    <div
      key={`${index}-${item}`}
      className={`ofc-location-suggestion ${index === highlighted ? 'is-selected' : ''}`}
      // mousedown keeps focus in the input so the blur handler doesn't close the list first.
      onMouseDown={e => e.preventDefault()}
      onClick={() => choose(item)}
      onMouseEnter={() => setHighlighted(index)}
    >
      {item}
    </div>
  );

  return (
    <>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setIsOpen(false);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <div className="ofc-location-suggestions">
          {pastMatches.length > 0 && (
            <div className="ofc-location-suggestions-heading">
              {t('modals.editEvent.fields.location.pastHeading')}
            </div>
          )}
          {pastMatches.map((item, i) => renderItem(item, i))}
          {canSearchOnline && (placeMatches.length > 0 || searching) && (
            <div className="ofc-location-suggestions-heading">
              {t('modals.editEvent.fields.location.placesHeading')}
            </div>
          )}
          {placeMatches.map((item, i) => renderItem(item, pastMatches.length + i))}
          {canSearchOnline && searching && placeMatches.length === 0 && (
            <div className="ofc-location-suggestions-status">
              {t('modals.editEvent.fields.location.searching')}
            </div>
          )}
        </div>
      )}
    </>
  );
};

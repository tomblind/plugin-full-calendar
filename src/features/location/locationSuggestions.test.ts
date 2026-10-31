import { requestUrl } from 'obsidian';
import { formatPhotonPlace, matchPastLocations, searchPlaces } from './locationSuggestions';

jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

const requestUrlMock = requestUrl as jest.MockedFunction<typeof requestUrl>;

describe('matchPastLocations', () => {
  const locations = ['Office', 'Coffee Shop on Main', 'Main Street Library', 'Gym'];

  it('returns the first locations for an empty query', () => {
    expect(matchPastLocations(locations, '  ', 2)).toEqual(['Office', 'Coffee Shop on Main']);
  });

  it('matches every word ignoring case and lists prefix matches first', () => {
    expect(matchPastLocations(locations, 'main')).toEqual([
      'Main Street Library',
      'Coffee Shop on Main'
    ]);
    expect(matchPastLocations(locations, 'shop MAIN')).toEqual(['Coffee Shop on Main']);
  });

  it('leaves out a location identical to the query', () => {
    expect(matchPastLocations(locations, 'gym')).toEqual([]);
  });
});

describe('formatPhotonPlace', () => {
  it('joins name, street, city, region and country', () => {
    expect(
      formatPhotonPlace({
        name: 'Red Rocks Amphitheatre',
        housenumber: '18300',
        street: 'West Alameda Parkway',
        city: 'Morrison',
        state: 'Colorado',
        postcode: '80465',
        country: 'United States'
      })
    ).toBe(
      'Red Rocks Amphitheatre, 18300 West Alameda Parkway, Morrison, Colorado 80465, United States'
    );
  });

  it('drops repeated parts and returns null when empty', () => {
    expect(formatPhotonPlace({ name: 'Denver', city: 'Denver', country: 'United States' })).toBe(
      'Denver, United States'
    );
    expect(formatPhotonPlace({})).toBeNull();
  });
});

describe('searchPlaces', () => {
  beforeEach(() => requestUrlMock.mockReset());

  it('does not search for short queries', async () => {
    expect(await searchPlaces('ab')).toEqual([]);
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  it('sends the query and location bias and formats the results', async () => {
    requestUrlMock.mockResolvedValue({
      json: {
        features: [
          { properties: { name: 'Union Station', city: 'Denver', country: 'United States' } },
          { properties: { name: 'Union Station', city: 'Denver', country: 'United States' } },
          { properties: {} }
        ]
      }
    } as unknown as Awaited<ReturnType<typeof requestUrl>>);

    const results = await searchPlaces('union st', { latitude: 39.7, longitude: -105 });

    expect(results).toEqual(['Union Station, Denver, United States']);
    const url = (requestUrlMock.mock.calls[0][0] as { url: string }).url;
    expect(url).toContain('q=union+st');
    expect(url).toContain('lat=39.7');
    expect(url).toContain('lon=-105');
  });

  it('returns an empty list when the request fails', async () => {
    requestUrlMock.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await searchPlaces('denver')).toEqual([]);
  });
});

import { isHttpUrl } from './url';

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://zoom.us/j/123456?pwd=xyz')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isHttpUrl('  https://meet.google.com/abc  ')).toBe(true);
  });

  it('rejects non-URL text', () => {
    expect(isHttpUrl('Conference Room B')).toBe(false);
    expect(isHttpUrl('http building, 2nd floor')).toBe(false);
    expect(isHttpUrl('123 Main St')).toBe(false);
  });

  it('rejects non-http schemes', () => {
    expect(isHttpUrl('tel:+1-555-0100')).toBe(false);
    expect(isHttpUrl('mailto:a@b.com')).toBe(false);
    expect(isHttpUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects empty / nullish values', () => {
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});

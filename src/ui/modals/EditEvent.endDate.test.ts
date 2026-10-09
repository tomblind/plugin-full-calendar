import { normalizeEndDate, shiftEndDate } from './EditEvent';

describe('shiftEndDate', () => {
  it('moves the end date by the same number of days as the start date', () => {
    expect(shiftEndDate('2026-10-09', '2026-10-12', '2026-10-11')).toBe('2026-10-14');
  });

  it('moves the end date backward when the start date moves earlier', () => {
    expect(shiftEndDate('2026-10-09', '2026-10-01', '2026-10-11')).toBe('2026-10-03');
  });

  it('keeps the event length across a month boundary', () => {
    expect(shiftEndDate('2026-10-30', '2026-11-01', '2026-11-02')).toBe('2026-11-04');
  });

  it('leaves an empty end date empty', () => {
    expect(shiftEndDate('2026-10-09', '2026-10-12', '')).toBe('');
  });

  it('leaves the end date unchanged when there was no previous start date', () => {
    expect(shiftEndDate('', '2026-10-12', '2026-10-11')).toBe('2026-10-11');
  });
});

describe('normalizeEndDate', () => {
  it('returns the end date when it is after the start date', () => {
    expect(normalizeEndDate('2026-10-09', '2026-10-11')).toBe('2026-10-11');
  });

  it('returns null when the event ends on its start date', () => {
    expect(normalizeEndDate('2026-10-09', '2026-10-09')).toBeNull();
  });

  it('returns null when the end date is before the start date', () => {
    expect(normalizeEndDate('2026-10-09', '2026-10-08')).toBeNull();
  });

  it('returns null when the end date is empty', () => {
    expect(normalizeEndDate('2026-10-09', '')).toBeNull();
  });
});

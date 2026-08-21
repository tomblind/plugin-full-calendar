/**
 * @jest-environment jsdom
 */
import FullCalendarPlugin from '../../main';
import { CalDAVProvider } from './CalDAVProvider';
import { obsidianFetch } from './obsidian-fetch_caldav';
import { CalDAVProviderConfig } from './typesCalDAV';

jest.mock('./obsidian-fetch_caldav', () => ({ obsidianFetch: jest.fn() }));

const mockFetch = obsidianFetch as jest.MockedFunction<typeof obsidianFetch>;

const config: CalDAVProviderConfig = {
  id: 'caldav_vevent_regression',
  name: 'Calendar',
  url: 'https://caldav.example.com/',
  homeUrl: 'https://caldav.example.com/calendars/events/',
  username: '',
  password: ''
};

const collectionInfo = `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response><d:propstat><d:prop>
    <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
    <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
  </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

const eventReport = `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response><d:href>/calendars/events/meeting.ics</d:href><d:propstat><d:prop>
    <d:getetag>"event-etag"</d:getetag>
    <c:calendar-data><![CDATA[BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:existing-event
SUMMARY:Team meeting
DTSTART:20260820T100000Z
DTEND:20260820T110000Z
END:VEVENT
END:VCALENDAR]]></c:calendar-data>
  </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

describe('CalDAV VEVENT regression', () => {
  beforeEach(() => mockFetch.mockReset());

  it('keeps the existing VEVENT CalDAV read path unchanged', async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 207,
        text: () => Promise.resolve(collectionInfo)
      } as Response)
      .mockResolvedValueOnce({ status: 207, text: () => Promise.resolve(eventReport) } as Response)
      .mockResolvedValueOnce({
        status: 207,
        text: () => Promise.resolve('<d:multistatus xmlns:d="DAV:"/>')
      } as Response);

    const provider = new CalDAVProvider(config, {} as FullCalendarPlugin);
    const events = await provider.getEvents({
      start: new Date('2026-08-01T00:00:00Z'),
      end: new Date('2026-09-01T00:00:00Z')
    });

    expect(events).toHaveLength(1);
    expect(events[0][0]).toMatchObject({
      uid: 'existing-event',
      title: 'Team meeting',
      caldavHref: '/calendars/events/meeting.ics',
      etag: 'event-etag'
    });
    expect(mockFetch.mock.calls[1][1]?.body).toEqual(
      expect.stringContaining('<c:comp-filter name="VEVENT">')
    );
  });
  it('preserves unmapped properties and sibling overrides when updating an event', async () => {
    const remoteObject = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:existing-event',
      'SUMMARY:Team meeting',
      'DTSTART:20260820T100000Z',
      'DTEND:20260820T110000Z',
      'LOCATION:Room 5',
      'ORGANIZER;CN=Boss:mailto:boss@example.com',
      'ATTENDEE;CN=Guest:mailto:guest@example.com',
      'CATEGORIES:WORK',
      'X-CUSTOM-FLAG:keep-me',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:existing-event',
      'RECURRENCE-ID:20260827T100000Z',
      'SUMMARY:Moved instance',
      'DTSTART:20260827T120000Z',
      'DTEND:20260827T130000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    mockFetch
      .mockResolvedValueOnce({ status: 200, text: () => Promise.resolve(remoteObject) } as Response)
      .mockResolvedValueOnce({ status: 204, statusText: 'No Content' } as Response);

    const provider = new CalDAVProvider(config, {} as FullCalendarPlugin);
    await provider.updateEvent(
      { persistentId: '/calendars/events/meeting.ics', uid: 'existing-event' },
      {
        type: 'single',
        uid: 'existing-event',
        title: 'Team meeting',
        date: '2026-08-20',
        endDate: null,
        allDay: false,
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 5'
      } as never,
      {
        type: 'single',
        uid: 'existing-event',
        title: 'Renamed meeting',
        date: '2026-08-20',
        endDate: null,
        allDay: false,
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 9'
      } as never
    );

    expect(mockFetch.mock.calls[0][1]?.method).toBe('GET');
    const put = mockFetch.mock.calls[1];
    expect(put[1]?.method).toBe('PUT');

    const body = put[1]?.body as string;
    // The plugin's own fields are updated...
    expect(body).toContain('SUMMARY:Renamed meeting');
    expect(body).toContain('LOCATION:Room 9');
    // ...while everything it does not model survives the write.
    expect(body).toContain('ORGANIZER;CN=Boss:mailto:boss@example.com');
    expect(body).toContain('ATTENDEE;CN=Guest:mailto:guest@example.com');
    expect(body).toContain('CATEGORIES:WORK');
    expect(body).toContain('X-CUSTOM-FLAG:keep-me');
    // ...including the recurrence override sharing the same calendar object.
    expect(body).toContain('RECURRENCE-ID:20260827T100000Z');
    expect(body).toContain('SUMMARY:Moved instance');
  });

  it('falls back to a full replacement when the existing object cannot be fetched', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch
      .mockResolvedValueOnce({ status: 404, statusText: 'Not Found' } as Response)
      .mockResolvedValueOnce({ status: 204, statusText: 'No Content' } as Response);

    const provider = new CalDAVProvider(config, {} as FullCalendarPlugin);
    await provider.updateEvent(
      { persistentId: '/calendars/events/meeting.ics', uid: 'existing-event' },
      {
        type: 'single',
        uid: 'existing-event',
        title: 'Old',
        date: '2026-08-20',
        endDate: null,
        allDay: true
      } as never,
      {
        type: 'single',
        uid: 'existing-event',
        title: 'New',
        date: '2026-08-20',
        endDate: null,
        allDay: true
      } as never
    );

    expect(mockFetch.mock.calls[0][1]?.method).toBe('GET');
    const put = mockFetch.mock.calls[1];
    expect(put[1]?.method).toBe('PUT');
    expect(put[1]?.body as string).toContain('SUMMARY:New');
    warn.mockRestore();
  });
});

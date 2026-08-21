import { buildLocationActions, getContextMenuCapabilities } from './EventContextMenuBuilder';
import { ProviderEventContext } from '../../providers/Provider';
import { OFCEvent } from '../../types';
import { openExternalUrl } from '../../utils/openExternalUrl';

jest.mock(
  'obsidian',
  () => ({
    Menu: class {},
    Notice: class {}
  }),
  { virtual: true }
);

jest.mock('../../features/i18n/i18n', () => ({
  t: (key: string) => key
}));

jest.mock('../../utils/openExternalUrl', () => ({
  openExternalUrl: jest.fn()
}));

const contextForLocation = (location?: string): ProviderEventContext =>
  ({ event: { location } as OFCEvent }) as ProviderEventContext;

describe('EventContextMenuBuilder capabilities', () => {
  it('preserves generic task actions by default for existing providers', () => {
    expect(
      getContextMenuCapabilities({
        canCreate: true,
        canEdit: true,
        canDelete: true
      }).allowGenericTaskActions
    ).toBe(true);
  });

  it('omits generic task actions for providers with native task semantics', () => {
    expect(
      getContextMenuCapabilities({
        canCreate: false,
        canEdit: true,
        canDelete: true,
        contextMenu: {
          providesNativeTaskSemantics: true
        }
      }).allowGenericTaskActions
    ).toBe(false);
  });

  it('lets a provider explicitly override native-task generic action defaults', () => {
    expect(
      getContextMenuCapabilities({
        canCreate: false,
        canEdit: true,
        canDelete: true,
        contextMenu: {
          providesNativeTaskSemantics: true,
          allowGenericTaskActions: true
        }
      }).allowGenericTaskActions
    ).toBe(true);
  });
});

describe('buildLocationActions', () => {
  beforeEach(() => {
    (openExternalUrl as jest.Mock).mockClear();
  });

  it('offers an open action when the location is a URL', () => {
    const actions = buildLocationActions(contextForLocation('https://meet.google.com/abc-def'));

    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('location:open-url');
    expect(actions[0].title).toBe('ui.view.contextMenu.openLocationUrl');
  });

  it('opens the extracted URL in the default browser when run', () => {
    const actions = buildLocationActions(
      contextForLocation('Zoom: https://zoom.us/j/123 (passcode 4321)')
    );
    void actions[0].run();

    expect(openExternalUrl).toHaveBeenCalledWith('https://zoom.us/j/123');
  });

  it('offers nothing for a physical location', () => {
    expect(buildLocationActions(contextForLocation('Conference Room 303'))).toEqual([]);
  });

  it('offers nothing when the event has no location', () => {
    expect(buildLocationActions(contextForLocation(undefined))).toEqual([]);
  });
});

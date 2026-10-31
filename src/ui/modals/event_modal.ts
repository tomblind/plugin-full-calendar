import { showNotice } from '../../utils/showNotice';
/**
 * @file event_modal.ts
 * @brief Provides functions to launch React-based modals for creating and editing events.
 *
 * @description
 * This file serves as the bridge between Obsidian's imperative UI system and
 * the declarative React world. The `launchCreateModal` and `launchEditModal`
 * functions are responsible for creating a `ReactModal` instance and mounting
 * the `EditEvent` React component within it, passing all necessary props and
 * callbacks for event submission and deletion.
 *
 * @see ReactModal.ts
 * @see components/EditEvent.tsx
 *
 * @exports launchCreateModal
 * @exports launchEditModal
 *
 * @license See LICENSE.md
 */

import { PluginState } from '../../core/PluginState';
import * as React from 'react';
import ReactModal from '../ReactModal';
import { TFile } from 'obsidian';

import { AttendanceResponse, OFCEvent } from '../../types';
import { EditEvent } from './EditEvent';
import { EventDetails } from './EventDetails';
import FullCalendarPlugin from '../../main';
import { ConfirmModal } from './ConfirmModal';
import { openOrCreateLinkedNote } from '../../utils/eventActions';
import { openLinkedFileInExistingLeafOrNew } from '../../utils/leafUtils';
import { t } from '../../features/i18n/i18n';
import { LinkedNoteIndex } from '../../providers/utils/LinkedNoteIndex';
import { selectDefaultCalendar } from '../../utils/writableCalendars';
import { AttendanceScope } from '../../providers/Provider';
import { chooseAttendanceScope } from './AttendanceScopeModal';
import { searchPlaces } from '../../features/location/locationSuggestions';

/**
 * Location suggestion props for the event editor. Online search is left out
 * when the user turned it off. Results near the weather location rank higher.
 */
function getLocationSuggestionProps() {
  const settings = PluginState.getSettings();
  const { weatherLatitude: latitude, weatherLongitude: longitude } = settings;
  const bias = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  return {
    availableLocations: PluginState.getCache().getAllLocations(),
    searchPlaces: settings.enableOnlineLocationSuggestions
      ? (query: string) => searchPlaces(query, bias)
      : undefined
  };
}

export function launchCreateModal(
  plugin: FullCalendarPlugin,
  partialEvent: Partial<OFCEvent>,
  defaultCalendarId?: string | null
) {
  const { candidates: calendars, index: finalCalIdx } = selectDefaultCalendar(defaultCalendarId);

  if (calendars.length === 0) {
    showNotice(t('modals.editEvent.errors.createNoCalendars'));
    return;
  }

  // MODIFICATION: Get available categories
  const availableCategories = PluginState.getCache().getAllCategories();

  new ReactModal(plugin.app, closeModal =>
    Promise.resolve(
      React.createElement(EditEvent, {
        initialEvent: partialEvent,
        calendars,
        defaultCalendarIndex: finalCalIdx,
        availableCategories,
        ...getLocationSuggestionProps(),
        enableCategory: PluginState.getSettings().enableAdvancedCategorization,
        enableBackgroundEvents: PluginState.getSettings().enableBackgroundEvents,
        enableReminders: PluginState.getSettings().enableReminders,
        submit: async (data, calendarIndex) => {
          const calendarId = calendars[calendarIndex].id;
          try {
            // Note: The data source layer is now responsible for constructing the full title.
            // The `data` object here has a clean title and category.
            await PluginState.getCache().addEvent(calendarId, data);
          } catch (e) {
            if (e instanceof Error) {
              showNotice(t('modals.editEvent.errors.createError', { message: e.message }));
              console.error(e);
            }
          }
          closeModal();
        },
        mode: 'create'
      })
    )
  ).open();
}

/**
 * @file
 * Provides the `launchEditModal` function for displaying and handling the event editing modal
 * in the FullCalendar plugin UI. This modal allows users to edit, move, or delete calendar events,
 * including handling inherited properties from recurring parent events and category selection.
 * Integrates with the plugin's cache and settings, and supports error handling and user confirmations.
 */
export function launchEditModal(
  plugin: FullCalendarPlugin,
  eventId: string,
  instanceDate?: string
) {
  const eventToEdit = PluginState.getCache().getEventById(eventId);
  if (!eventToEdit) {
    throw new Error("Cannot edit event that doesn't exist.");
  }
  const eventDetails = PluginState.getCache().store.getEventDetails(eventId);
  if (!eventDetails) {
    throw new Error(`Cannot edit event with ID ${eventId} that doesn't exist in the store.`);
  }
  const calId = eventDetails.calendarId; // This is the RUNTIME ID.

  let location = eventDetails.location;
  const provider = PluginState.getProviderRegistry().getInstance(calId);
  if (provider && 'linkedNoteIndex' in provider && provider.linkedNoteIndex) {
    const linkedFile = (provider.linkedNoteIndex as LinkedNoteIndex).getFileForEvent(
      eventToEdit.uid || '',
      instanceDate
    );
    if (linkedFile) {
      location = { path: linkedFile.path, lineNumber: undefined };
    } else if (instanceDate) {
      location = null;
    }
  }

  const calendars = PluginState.getProviderRegistry()
    .getAllSources()
    .filter(s => s.type !== 'FOR_TEST_ONLY')
    .map(info => {
      const instance = PluginState.getProviderRegistry().getInstance(info.id);
      if (!instance) return null;
      const capabilities = instance.getCapabilities();
      if (!capabilities.canEdit && !capabilities.canCreate) return null;

      return {
        id: info.id,
        type: info.type,
        name: info.name || ''
      };
    })
    .filter((c): c is NonNullable<typeof c> => !!c);

  const calIdx = calendars.findIndex(({ id }) => id === calId);
  const availableCategories = PluginState.getCache().getAllCategories();

  const sendAttendance = provider?.setAttendance?.bind(provider);
  let replySent = false;
  const onSetAttendance =
    sendAttendance && eventToEdit.attendance
      ? async (response: AttendanceResponse): Promise<boolean> => {
          const isMaster = eventToEdit.type === 'rrule' || eventToEdit.type === 'recurring';
          let scope: AttendanceScope = 'instance';
          if (isMaster && !instanceDate) {
            // Opened as the series itself, so there is no single occurrence to reply to.
            scope = 'series';
          } else if (isMaster || eventToEdit.recurringEventId) {
            const chosen = await chooseAttendanceScope(plugin.app);
            if (!chosen) return false;
            scope = chosen;
          }
          try {
            await sendAttendance(eventToEdit, response, scope, instanceDate);
            replySent = true;
            PluginState.getProviderRegistry().reloadProviderNow(calId);
            return true;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            showNotice(t('modals.editEvent.errors.attendanceError', { message }));
            console.error(e);
            return false;
          }
        }
      : undefined;

  new ReactModal(plugin.app, closeModal => {
    const onAttemptEditInherited = () => {
      new ConfirmModal(
        plugin.app,
        t('modals.editEvent.confirmations.editParentTitle'),
        t('modals.editEvent.confirmations.editParentMessage'),
        () => {
          void (async () => {
            if (eventToEdit.type === 'single' && eventToEdit.recurringEventId) {
              const parentLocalId = eventToEdit.recurringEventId;
              const parentGlobalId = `${calId}::${parentLocalId}`; // <-- CHANGE calendarId to calId
              const parentSessionId = await PluginState.getCache().getSessionId(parentGlobalId);
              if (parentSessionId) {
                closeModal();
                launchEditModal(plugin, parentSessionId);
              } else {
                showNotice(t('modals.editEvent.errors.parentNotFound'));
              }
            }
          })();
        }
      ).open();
    };

    return Promise.resolve(
      React.createElement(EditEvent, {
        initialEvent: eventToEdit,
        calendars,
        defaultCalendarIndex: calIdx,
        availableCategories,
        ...getLocationSuggestionProps(),
        enableCategory: PluginState.getSettings().enableAdvancedCategorization,
        enableBackgroundEvents: PluginState.getSettings().enableBackgroundEvents,
        enableReminders: PluginState.getSettings().enableReminders,
        submit: async (data, calendarIndex) => {
          try {
            const newCalendarSettingsId = calendars[calendarIndex].id;
            const oldCalendarSettingsId = eventDetails.calendarId;

            if (newCalendarSettingsId !== oldCalendarSettingsId) {
              await PluginState.getCache().moveEventToCalendar(
                eventId,
                newCalendarSettingsId,
                data
              );
            } else {
              await PluginState.getCache().updateEventWithId(eventId, data);
            }
            if (replySent) {
              // The save wrote the reply the window opened with, so fetch the new one again.
              PluginState.getProviderRegistry().reloadProviderNow(calId);
            }
          } catch (e) {
            if (e instanceof Error) {
              showNotice(t('modals.editEvent.errors.updateError', { message: e.message }));
              console.error(e);
            }
          }
          closeModal();
        },
        open: async () => {
          if (location) {
            const file = plugin.app.vault.getAbstractFileByPath(location.path);
            if (file instanceof TFile) {
              await openLinkedFileInExistingLeafOrNew(plugin.app, file);
            }
          } else {
            await openOrCreateLinkedNote(plugin, calId, eventToEdit, true, instanceDate);
          }
          closeModal();
        },
        deleteEvent: async () => {
          try {
            await PluginState.getCache().deleteEvent(eventId, { instanceDate });
            closeModal();
          } catch (e) {
            if (e instanceof Error) {
              showNotice(t('modals.editEvent.errors.deleteError', { message: e.message }));
              console.error(e);
            }
          }
        },
        onAttemptEditInherited, // Pass the new handler as a prop
        onSetAttendance,
        mode: 'edit'
      })
    );
  }).open();
}

export function launchEventDetailsModal(
  plugin: FullCalendarPlugin,
  eventId: string,
  instanceDate?: string
) {
  const event = PluginState.getCache().getEventById(eventId);
  if (!event) {
    showNotice(t('modals.editEvent.errors.eventNotFound'));
    return;
  }
  const eventDetails = PluginState.getCache().store.getEventDetails(eventId);
  if (!eventDetails) {
    showNotice(t('modals.editEvent.errors.detailsNotFound'));
    return;
  }

  const calendarId = eventDetails.calendarId;
  const calendar = PluginState.getProviderRegistry().getSource(calendarId);
  const calendarName =
    calendar && calendar.name ? calendar.name : t('modals.editEvent.misc.unknownCalendar');

  let location = eventDetails.location;
  const provider = PluginState.getProviderRegistry().getInstance(calendarId);
  if (provider && 'linkedNoteIndex' in provider && provider.linkedNoteIndex) {
    const linkedFile = (provider.linkedNoteIndex as LinkedNoteIndex).getFileForEvent(
      event.uid || event.id || '',
      instanceDate
    );
    if (linkedFile) {
      location = { path: linkedFile.path, lineNumber: undefined };
    } else if (instanceDate) {
      location = null;
    }
  }

  new ReactModal(plugin.app, closeModal => {
    const linkedNoteProvider = provider as unknown as {
      createLinkedNote?: (event: OFCEvent, instanceDate?: string) => Promise<unknown>;
    };
    const hasCreateLinkedNote =
      linkedNoteProvider && typeof linkedNoteProvider.createLinkedNote === 'function';

    const onOpenNote =
      hasCreateLinkedNote || location
        ? () => {
            void (async () => {
              closeModal();
              if (location) {
                const file = plugin.app.vault.getAbstractFileByPath(location.path);
                if (file instanceof TFile) {
                  await openLinkedFileInExistingLeafOrNew(plugin.app, file);
                }
              } else if (hasCreateLinkedNote) {
                await openOrCreateLinkedNote(plugin, calendarId, event, false, instanceDate);
              }
            })();
          }
        : undefined;

    return Promise.resolve(
      React.createElement(EventDetails, {
        event,
        calendarName,
        location,
        instanceDate,
        onClose: () => closeModal(),
        onOpenNote
      })
    );
  }).open();
}

// src/ui/modals/AttendanceScopeModal.ts

import { App, ButtonComponent, Modal, Setting } from 'obsidian';
import { t } from '../../features/i18n/i18n';
import { AttendanceScope } from '../../providers/Provider';

/**
 * Asks whether a reply to a recurring invitation applies to the occurrence the
 * user opened or to every event in the series.
 */
class AttendanceScopeModal extends Modal {
  private chosen: AttendanceScope | null = null;

  constructor(
    app: App,
    private onDone: (scope: AttendanceScope | null) => void
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass('full-calendar-confirm-modal');
    const { contentEl } = this;
    contentEl.createEl('h2', { text: t('modals.attendanceScope.title') });
    contentEl.createEl('p', { text: t('modals.attendanceScope.description') });

    new Setting(contentEl)
      .addButton((btn: ButtonComponent) =>
        btn
          .setButtonText(t('modals.attendanceScope.thisEvent'))
          .setCta()
          .onClick(() => this.choose('instance'))
      )
      .addButton((btn: ButtonComponent) =>
        btn
          .setButtonText(t('modals.attendanceScope.allEvents'))
          .onClick(() => this.choose('series'))
      )
      .addButton((btn: ButtonComponent) =>
        btn.setButtonText(t('modals.attendanceScope.cancel')).onClick(() => this.close())
      );
  }

  private choose(scope: AttendanceScope) {
    this.chosen = scope;
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    this.onDone(this.chosen);
  }
}

/** Resolves to the chosen scope, or null when the user cancels. */
export function chooseAttendanceScope(app: App): Promise<AttendanceScope | null> {
  return new Promise(resolve => new AttendanceScopeModal(app, resolve).open());
}

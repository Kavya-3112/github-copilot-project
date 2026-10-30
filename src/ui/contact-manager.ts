import { ContactState } from "../app/contact-state";
import type { ContactFieldErrors } from "../contacts/types";
import type { ContactRepository } from "../storage/repository";

const privacyNotice = "Contacts are stored in this browser profile only. They are not encrypted, backed up, or synced. People sharing this browser profile and scripts running on this site may be able to access them.";

export function mountContactManager(
  root: HTMLElement,
  state: ContactState,
  repository: ContactRepository,
  onLogout: () => void,
): void {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="wordmark" href="#top">contact<span>book</span></a>
        <div class="topbar-actions">
          <a class="privacy-link" href="#privacy-notice">Privacy notice</a>
          <button id="logout-button" class="button button-quiet" type="button">Log out</button>
        </div>
      </header>
      <main id="top" class="workspace">
        <section class="page-heading" aria-labelledby="page-title">
          <div>
            <p class="eyebrow">YOUR PERSONAL DIRECTORY</p>
            <h1 id="page-title">Contacts</h1>
          </div>
          <button id="add-contact" class="button button-primary" type="button">Add contact</button>
        </section>

        <aside id="first-save-notice" class="privacy-callout" aria-label="Privacy notice">
          <span class="privacy-mark" aria-hidden="true">i</span>
          <p>${privacyNotice}</p>
        </aside>

        <section class="tools" aria-label="Contact list tools">
          <label class="search-field" for="contact-search">
            <span class="search-icon" aria-hidden="true"></span>
            <input id="contact-search" type="search" autocomplete="off" placeholder="Search by name or phone" aria-label="Search by name or phone" aria-controls="contact-list" />
          </label>
          <p id="list-announcement" class="list-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
        </section>

        <section id="loading-panel" class="message-panel" role="status" aria-live="polite" hidden>
          <h2>Loading contacts</h2><p>Checking browser storage…</p>
        </section>
        <section id="load-error-panel" class="message-panel message-error" aria-labelledby="load-error-title" hidden>
          <h2 id="load-error-title">Contacts are unavailable</h2>
          <p id="load-error"></p>
          <button id="retry-load" class="button button-secondary" type="button">Try again</button>
        </section>
        <p id="recovery-announcement" class="recovery-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
        <section id="contacts-panel" aria-labelledby="list-title" hidden>
          <div class="list-heading">
            <h2 id="list-title" tabindex="-1">All contacts</h2>
            <span id="contact-count" class="count-label"></span>
          </div>
          <ul id="contact-list" class="contact-list" aria-label="Contacts"></ul>
          <div id="empty-state" class="empty-state" hidden>
            <div class="empty-glyph" aria-hidden="true">+</div>
            <h3 id="empty-state-title" tabindex="-1">No contacts yet</h3>
            <p>Your directory is ready when you are.</p>
            <button class="button button-secondary" type="button" data-action="add">Add your first contact</button>
          </div>
          <div id="no-match-state" class="empty-state no-match" hidden>
            <h3>No matches found</h3>
            <p>Try another name or phone number, or clear your search.</p>
          </div>
        </section>

        <section id="save-status-panel" class="save-status" aria-live="polite" aria-atomic="true" hidden>
          <p id="save-status-message" role="status"></p>
          <div id="save-actions" class="save-actions" hidden>
            <button id="retry-save" class="button button-secondary" type="button">Retry save</button>
            <button id="discard-changes" class="button button-quiet" type="button">Discard changes</button>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <span>Stored only in this browser profile</span>
        <a href="#privacy-notice">Privacy notice</a>
        <p id="privacy-notice" tabindex="-1">${privacyNotice}</p>
      </footer>

      <dialog id="contact-dialog" class="dialog" aria-labelledby="contact-dialog-title">
        <form id="contact-form" novalidate>
          <div class="dialog-heading">
            <p class="eyebrow">CONTACT DETAILS</p>
            <h2 id="contact-dialog-title">Add contact</h2>
          </div>
          <div class="field-group">
            <label for="contact-name">Name</label>
            <input id="contact-name" name="name" type="text" autocomplete="name" required aria-describedby="name-hint name-error" />
            <p id="name-hint" class="field-hint">Enter the name you want to see in your list.</p>
            <p id="name-error" class="field-error" hidden></p>
          </div>
          <div class="field-group">
            <label for="contact-phone">Phone number</label>
            <input id="contact-phone" name="phone" type="tel" autocomplete="tel" required aria-describedby="phone-hint phone-error" />
            <p id="phone-hint" class="field-hint">Use 7–15 digits. Spaces, hyphens, parentheses, and a leading + are accepted.</p>
            <p id="phone-error" class="field-error" hidden></p>
          </div>
          <p id="form-message" class="form-message" role="alert" aria-live="assertive"></p>
          <div class="dialog-actions">
            <button id="cancel-form" class="button button-quiet" type="button">Cancel</button>
            <button id="submit-contact" class="button button-primary" type="submit">Save contact</button>
          </div>
        </form>
      </dialog>

      <dialog id="delete-dialog" class="dialog dialog-compact" aria-labelledby="delete-title" aria-describedby="delete-description">
        <div class="dialog-heading">
          <p class="eyebrow">REMOVE CONTACT</p>
          <h2 id="delete-title">Delete this contact?</h2>
        </div>
        <p id="delete-description">This contact will be removed from the contact list stored in this browser profile.</p>
        <p id="delete-contact-name" class="delete-contact-name"></p>
        <div class="dialog-actions">
          <button id="cancel-delete" class="button button-quiet" type="button">Keep contact</button>
          <button id="confirm-delete" class="button button-danger" type="button">Delete contact</button>
        </div>
      </dialog>

      <dialog id="recovery-dialog" class="dialog dialog-compact" aria-labelledby="recovery-title" aria-describedby="recovery-description">
        <div class="dialog-heading">
          <p class="eyebrow">STORAGE RECOVERY</p>
          <h2 id="recovery-title">Stored contacts need attention</h2>
        </div>
        <p id="recovery-description"></p>
        <p id="recovery-count" class="recovery-count"></p>
        <p id="recovery-feedback" class="field-error" role="alert" aria-live="assertive"></p>
        <p class="recovery-caution">The original stored data will be preserved before recovery. Nothing is replaced unless you choose to continue.</p>
        <div class="dialog-actions">
          <button id="confirm-recovery" class="button button-primary" type="button">Back up original and recover</button>
        </div>
      </dialog>
    </div>`;

  const query = <T extends HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  };

  const contactDialog = query<HTMLDialogElement>("#contact-dialog");
  const deleteDialog = query<HTMLDialogElement>("#delete-dialog");
  const recoveryDialog = query<HTMLDialogElement>("#recovery-dialog");
  const form = query<HTMLFormElement>("#contact-form");
  const searchInput = query<HTMLInputElement>("#contact-search");
  let renderedFormKey: string | null = null;
  let fieldErrors: ContactFieldErrors = {};
  let recoveryFeedback = "";
  let recoveryAnnouncement = "";
  let isRecovering = false;

  const setFieldError = (field: "name" | "phone", message: string | undefined): void => {
    const input = query<HTMLInputElement>(`#contact-${field}`);
    const error = query<HTMLElement>(`#${field}-error`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message ?? "";
    error.hidden = !message;
  };

  const renderList = (): void => {
    const snapshot = state.snapshot;
    const list = query<HTMLUListElement>("#contact-list");
    const empty = query<HTMLElement>("#empty-state");
    const noMatch = query<HTMLElement>("#no-match-state");
    const filtered = state.visibleContacts;
    const allContacts = snapshot.document?.contacts ?? [];
    list.replaceChildren();

    for (const contact of filtered) {
      const item = document.createElement("li");
      const article = document.createElement("article");
      article.className = "contact-row";
      const details = document.createElement("div");
      details.className = "contact-details";
      const name = document.createElement("h3");
      name.textContent = contact.name;
      const phone = document.createElement("p");
      phone.textContent = contact.phone;
      details.append(name, phone);

      const actions = document.createElement("div");
      actions.className = "contact-actions";
      for (const [action, label, className] of [
        ["edit", "Edit", "button button-small button-secondary"],
        ["delete", "Delete", "button button-small button-quiet"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${contact.name}`);
        button.dataset.action = action;
        button.dataset.contactId = contact.id;
        actions.append(button);
      }
      article.append(details, actions);
      item.append(article);
      list.append(item);
    }

    const hasQuery = snapshot.query.trim().length > 0;
    empty.hidden = allContacts.length > 0 || hasQuery;
    noMatch.hidden = !hasQuery || filtered.length > 0;
    query<HTMLElement>("#contact-count").textContent = `${allContacts.length} ${allContacts.length === 1 ? "contact" : "contacts"}`;
    query<HTMLElement>("#list-announcement").textContent = hasQuery
      ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
      : `${allContacts.length} ${allContacts.length === 1 ? "contact" : "contacts"}`;
  };

  const focusAfterDelete = (deletedIndex: number): void => {
    const remaining = state.visibleContacts;
    if (remaining.length > 0) {
      const nextContact = remaining[Math.min(Math.max(deletedIndex, 0), remaining.length - 1)];
      const nextAction = [...root.querySelectorAll<HTMLButtonElement>('button[data-action="edit"]')]
        .find((button) => button.dataset.contactId === nextContact.id);
      nextAction?.focus();
      return;
    }

    if ((state.snapshot.document?.contacts.length ?? 0) === 0) {
      query<HTMLHeadingElement>("#empty-state-title").focus();
    } else {
      query<HTMLHeadingElement>("#list-title").focus();
    }
  };

  const renderForm = (snapshot: ReturnType<ContactState["snapshot"] extends never ? never : () => ContactState["snapshot"]>): void => {
    const formKey = snapshot.form
      ? snapshot.form.mode === "create" ? "create" : `edit:${snapshot.form.contactId}`
      : null;
    if (formKey !== renderedFormKey) {
      renderedFormKey = formKey;
      fieldErrors = {};
      query<HTMLElement>("#form-message").textContent = "";
      if (snapshot.form) {
        query<HTMLHeadingElement>("#contact-dialog-title").textContent = snapshot.form.mode === "create" ? "Add contact" : "Edit contact";
        query<HTMLButtonElement>("#submit-contact").textContent = snapshot.form.mode === "create" ? "Save contact" : "Save changes";
        query<HTMLInputElement>("#contact-name").value = snapshot.form.draft.name;
        query<HTMLInputElement>("#contact-phone").value = snapshot.form.draft.phone;
      }
      for (const field of ["name", "phone"] as const) setFieldError(field, undefined);
    }

    if (snapshot.form && !contactDialog.open) contactDialog.showModal();
    if (!snapshot.form && contactDialog.open) contactDialog.close();
  };

  const render = (snapshot: ReturnType<ContactState["snapshot"] extends never ? never : () => ContactState["snapshot"]>): void => {
    const loading = snapshot.loadStatus === "loading";
    const ready = snapshot.loadStatus === "ready";
    const unreadable = snapshot.loadStatus === "unreadable";
    query<HTMLElement>("#loading-panel").hidden = !loading;
    query<HTMLElement>("#load-error-panel").hidden = snapshot.loadStatus !== "failed";
    query<HTMLElement>("#contacts-panel").hidden = !ready;
    query<HTMLButtonElement>("#add-contact").disabled = !ready || snapshot.saveStatus === "saving";
    searchInput.disabled = !ready;
    if (document.activeElement !== searchInput) searchInput.value = snapshot.query;
    query<HTMLElement>("#load-error").textContent = snapshot.error ?? "";
    query<HTMLButtonElement>("#retry-load").disabled = loading;

    const persisted = snapshot.persistedDocument;
    query<HTMLElement>("#first-save-notice").hidden = !ready
      || !persisted
      || persisted.nextCreatedOrder > 0
      || persisted.contacts.length > 0;

    const savePanel = query<HTMLElement>("#save-status-panel");
    const saveMessage = query<HTMLElement>("#save-status-message");
    const saveActions = query<HTMLElement>("#save-actions");
    savePanel.hidden = !ready || snapshot.saveStatus === "idle" || snapshot.saveStatus === "saved";
    saveActions.hidden = snapshot.saveStatus !== "unsaved";
    if (snapshot.saveStatus === "saving") saveMessage.textContent = "Saving changes…";
    else if (snapshot.saveStatus === "unsaved") saveMessage.textContent = `Changes are not saved. ${snapshot.error ?? "Browser storage could not save them."}`;
    else saveMessage.textContent = "Changes saved.";
    query<HTMLButtonElement>("#retry-save").disabled = snapshot.saveStatus === "saving";
    query<HTMLButtonElement>("#discard-changes").disabled = snapshot.saveStatus === "saving";
    query<HTMLElement>("#recovery-announcement").textContent = recoveryAnnouncement;

    if (ready) renderList();
    renderForm(snapshot);

    if (unreadable && snapshot.recovery) {
      query<HTMLElement>("#recovery-description").textContent = snapshot.error ?? "Stored contacts could not be read.";
      query<HTMLElement>("#recovery-count").textContent = snapshot.recovery.salvageCount > 0
        ? `${snapshot.recovery.salvageCount} valid ${snapshot.recovery.salvageCount === 1 ? "contact is" : "contacts are"} available to recover.`
        : "No valid contacts could be recovered. Continuing will create an empty contact list after the original data is backed up.";
      query<HTMLElement>("#recovery-feedback").textContent = recoveryFeedback;
      const recoveryButton = query<HTMLButtonElement>("#confirm-recovery");
      recoveryButton.disabled = isRecovering;
      recoveryButton.textContent = isRecovering ? "Recovering…" : recoveryFeedback ? "Retry recovery" : "Back up original and recover";
      if (!recoveryDialog.open) recoveryDialog.showModal();
    } else if (recoveryDialog.open) {
      recoveryDialog.close();
      recoveryFeedback = "";
    }

    const pendingDelete = snapshot.pendingDeleteId
      ? snapshot.document?.contacts.find((contact) => contact.id === snapshot.pendingDeleteId)
      : null;
    if (pendingDelete) {
      query<HTMLElement>("#delete-contact-name").textContent = pendingDelete.name;
      if (!deleteDialog.open) deleteDialog.showModal();
    } else if (deleteDialog.open) deleteDialog.close();
  };

  state.subscribe(render);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionButton = target.closest<HTMLButtonElement>("button[data-action]");
    if (actionButton) {
      if (actionButton.dataset.action === "add") state.openCreate();
      if (actionButton.dataset.action === "edit" && actionButton.dataset.contactId) state.openEdit(actionButton.dataset.contactId);
      if (actionButton.dataset.action === "delete" && actionButton.dataset.contactId) state.requestDelete(actionButton.dataset.contactId);
    }
  });

  query<HTMLButtonElement>("#add-contact").addEventListener("click", () => state.openCreate());
  query<HTMLButtonElement>("#logout-button").addEventListener("click", () => onLogout());
  query<HTMLButtonElement>("#retry-load").addEventListener("click", () => void state.load());
  searchInput.addEventListener("input", () => state.setQuery(searchInput.value));

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || (target.name !== "name" && target.name !== "phone")) return;
    if (fieldErrors[target.name]) {
      delete fieldErrors[target.name];
      setFieldError(target.name, undefined);
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await state.submitForm({
      name: query<HTMLInputElement>("#contact-name").value,
      phone: query<HTMLInputElement>("#contact-phone").value,
    });
    if (result.kind === "invalid") {
      fieldErrors = result.errors;
      setFieldError("name", result.errors.name);
      setFieldError("phone", result.errors.phone);
      query<HTMLElement>("#form-message").textContent = "Review the highlighted fields.";
      const firstInvalid = result.errors.name ? "#contact-name" : "#contact-phone";
      query<HTMLInputElement>(firstInvalid).focus();
    } else if (result.kind === "failed") {
      query<HTMLElement>("#form-message").textContent = result.reason;
    }
  });
  query<HTMLButtonElement>("#cancel-form").addEventListener("click", () => state.cancelForm());
  contactDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    state.cancelForm();
  });

  query<HTMLButtonElement>("#cancel-delete").addEventListener("click", () => state.cancelDelete());
  query<HTMLButtonElement>("#confirm-delete").addEventListener("click", async () => {
    const pendingDeleteId = state.snapshot.pendingDeleteId;
    const deletedIndex = pendingDeleteId
      ? state.visibleContacts.findIndex((contact) => contact.id === pendingDeleteId)
      : -1;
    const result = await state.confirmDelete();
    if (result.kind === "saved" || result.kind === "unsaved") focusAfterDelete(deletedIndex);
  });
  deleteDialog.addEventListener("cancel", () => state.cancelDelete());

  query<HTMLButtonElement>("#retry-save").addEventListener("click", () => void state.retrySave());
  query<HTMLButtonElement>("#discard-changes").addEventListener("click", () => state.discardChanges());

  recoveryDialog.addEventListener("cancel", (event) => event.preventDefault());
  query<HTMLButtonElement>("#confirm-recovery").addEventListener("click", async () => {
    const recovery = state.snapshot.recovery;
    if (!recovery || isRecovering) return;
    isRecovering = true;
    recoveryFeedback = "";
    render(state.snapshot);
    const result = await repository.recover(recovery.recoveryId, true);
    isRecovering = false;
    if (result.kind === "recovered") {
      const reloadResult = await state.load();
      if (reloadResult.kind === "loaded" || reloadResult.kind === "empty") {
        recoveryAnnouncement = "Recovery completed. The original data is preserved in a verified backup.";
        query<HTMLElement>("#recovery-announcement").textContent = recoveryAnnouncement;
        const restoredContacts = state.snapshot.document?.contacts ?? [];
        query<HTMLHeadingElement>(restoredContacts.length > 0 ? "#list-title" : "#empty-state-title").focus();
      } else if (reloadResult.kind === "unreadable") {
        recoveryAnnouncement = "";
        recoveryFeedback = "Recovery data was saved, but contacts are still unreadable. The original data remains backed up. Review this issue before retrying recovery.";
        render(state.snapshot);
        query<HTMLButtonElement>("#confirm-recovery").focus();
      } else {
        recoveryAnnouncement = "Recovery was saved, but contacts could not be reloaded. Select Try again to reload contacts.";
        query<HTMLElement>("#recovery-announcement").textContent = recoveryAnnouncement;
        if (state.snapshot.loadStatus === "failed") query<HTMLButtonElement>("#retry-load").focus();
      }
    } else if (result.kind === "retryable-failure" || result.kind === "blocked") {
      recoveryFeedback = result.reason;
      render(state.snapshot);
    } else {
      recoveryFeedback = "Recovery requires confirmation. Your original data has not been replaced.";
      render(state.snapshot);
    }
  });
}
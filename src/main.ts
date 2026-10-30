import "./styles.css";
import { AuthState, isContactAccessAuthorized } from "./auth/auth-state";
import { CredentialRepository, createBrowserCredentialStoragePort } from "./auth/credential-repository";
import { createBrowserSessionPort } from "./auth/session";
import { ContactState, installUnsavedChangesWarning } from "./app/contact-state";
import { ContactRepository, createBrowserStoragePort } from "./storage/repository";
import { mountContactManager } from "./ui/contact-manager";
import { mountLoginGate } from "./ui/login-view";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("The application root is unavailable.");

const authRoot = document.createElement("div");
const appRoot = document.createElement("div");
appRoot.hidden = true;
root.append(authRoot, appRoot);

const authState = new AuthState(
  new CredentialRepository(createBrowserCredentialStoragePort()),
  createBrowserSessionPort(),
);

// Explicit lifecycle state tracking to prevent inconsistent UI states
type MountedView = "none" | "login" | "contact";
let currentView: MountedView = "none";
let uninstallUnsavedWarning: (() => void) | null = null;

mountLoginGate(authRoot, authState);
currentView = "login";

authState.subscribe((snapshot) => {
  const authorized = isContactAccessAuthorized(snapshot);
  authRoot.hidden = authorized;
  appRoot.hidden = !authorized;

  if (authorized) {
    // Only mount contact manager if not already mounted
    if (currentView !== "contact") {
      try {
        const repository = new ContactRepository(createBrowserStoragePort());
        const contactState = new ContactState(repository);
        mountContactManager(appRoot, contactState, repository, () => authState.logout());
        uninstallUnsavedWarning = installUnsavedChangesWarning(contactState);
        void contactState.load();
        currentView = "contact";
      } catch (error) {
        // If mounting fails, clean up any partially created UI
        cleanupContactView();
        // Display a safe error message to the user
        appRoot.innerHTML = `
          <div class="app-shell">
            <main class="workspace">
              <section class="message-panel message-error">
                <h2>Unable to load contact manager</h2>
                <p>The application encountered an error while loading. Please try logging out and logging in again.</p>
                <button id="error-logout" class="button button-secondary" type="button">Log out</button>
              </section>
            </main>
          </div>`;
        const logoutButton = appRoot.querySelector<HTMLButtonElement>("#error-logout");
        if (logoutButton) {
          logoutButton.addEventListener("click", () => authState.logout());
        }
        currentView = "contact"; // Mark as mounted to prevent duplicate attempts
        // Log the actual error for debugging (not exposed to user)
        console.error("Contact manager mount failed:", error);
      }
    }
  } else {
    // Only cleanup contact manager if it was mounted
    if (currentView === "contact") {
      cleanupContactView();
      currentView = "login";
    }
  }
});

function cleanupContactView(): void {
  uninstallUnsavedWarning?.();
  uninstallUnsavedWarning = null;
  appRoot.innerHTML = "";
}

authState.load();

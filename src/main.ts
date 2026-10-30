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

let uninstallUnsavedWarning: (() => void) | null = null;

mountLoginGate(authRoot, authState);

authState.subscribe((snapshot) => {
  const authorized = isContactAccessAuthorized(snapshot);
  authRoot.hidden = authorized;
  appRoot.hidden = !authorized;

  if (authorized) {
    if (appRoot.childElementCount === 0) {
      const repository = new ContactRepository(createBrowserStoragePort());
      const contactState = new ContactState(repository);
      mountContactManager(appRoot, contactState, repository, () => authState.logout());
      uninstallUnsavedWarning = installUnsavedChangesWarning(contactState);
      void contactState.load();
    }
  } else if (appRoot.childElementCount > 0) {
    uninstallUnsavedWarning?.();
    uninstallUnsavedWarning = null;
    appRoot.innerHTML = "";
  }
});

authState.load();

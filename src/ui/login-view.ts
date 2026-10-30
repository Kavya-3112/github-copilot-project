import { AuthState } from "../auth/auth-state";
import type { CredentialFieldErrors } from "../auth/types";

const localOnlyDisclosure = "This sign-in is a local convenience gate for this browser profile only. "
  + "It is not an encrypted or server-verified account system, and it does not protect against anyone "
  + "with access to this browser's storage or developer tools. The only way to reset a forgotten "
  + "username or passcode is to clear this browser's storage, which also deletes every saved contact.";

export function mountLoginGate(root: HTMLElement, authState: AuthState): void {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="wordmark" href="#auth-top">contact<span>book</span></a>
      </header>
      <main id="auth-top" class="workspace auth-workspace">
        <section class="page-heading" aria-labelledby="auth-title">
          <div>
            <p class="eyebrow">LOCAL SIGN-IN</p>
            <h1 id="auth-title">Sign in</h1>
          </div>
        </section>

        <p id="auth-disclosure" class="auth-disclosure">${localOnlyDisclosure}</p>

        <section id="auth-loading-panel" class="message-panel" role="status" aria-live="polite" hidden>
          <h2>Checking for a saved sign-in</h2>
          <p>Checking browser storage…</p>
        </section>

        <section id="auth-unavailable-panel" class="message-panel message-error" aria-labelledby="auth-unavailable-title" hidden>
          <h2 id="auth-unavailable-title">Sign-in is unavailable</h2>
          <p id="auth-unavailable-reason"></p>
          <button id="auth-retry" class="button button-secondary" type="button">Try again</button>
        </section>

        <form id="auth-form" novalidate>
          <div class="field-group">
            <label for="auth-username">Username</label>
            <input id="auth-username" name="username" type="text" autocomplete="username" required aria-describedby="auth-username-error" />
            <p id="auth-username-error" class="field-error" hidden></p>
          </div>
          <div class="field-group">
            <label for="auth-passcode">Passcode</label>
            <input id="auth-passcode" name="passcode" type="password" autocomplete="current-password" required aria-describedby="auth-passcode-error" />
            <p id="auth-passcode-error" class="field-error" hidden></p>
          </div>
          <p id="auth-message" class="form-message" role="alert" aria-live="assertive"></p>
          <div class="dialog-actions">
            <button id="auth-submit" class="button button-primary" type="submit">Sign in</button>
          </div>
        </form>
      </main>
    </div>`;

  const query = <T extends HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  };

  const form = query<HTMLFormElement>("#auth-form");
  const usernameInput = query<HTMLInputElement>("#auth-username");
  const passcodeInput = query<HTMLInputElement>("#auth-passcode");
  let fieldErrors: CredentialFieldErrors = {};

  const setFieldError = (field: "username" | "passcode", message: string | undefined): void => {
    const input = field === "username" ? usernameInput : passcodeInput;
    const error = query<HTMLElement>(`#auth-${field}-error`);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message ?? "";
    error.hidden = !message;
  };

  const render = (snapshot: ReturnType<AuthState["snapshot"] extends never ? never : () => AuthState["snapshot"]>): void => {
    const loading = snapshot.status === "loading";
    const unavailable = snapshot.status === "unavailable";
    const needsSetup = snapshot.status === "needs-setup";
    const needsLogin = snapshot.status === "needs-login";

    query<HTMLElement>("#auth-loading-panel").hidden = !loading;
    query<HTMLElement>("#auth-unavailable-panel").hidden = !unavailable;
    query<HTMLElement>("#auth-unavailable-reason").textContent = snapshot.error ?? "";
    form.hidden = !(needsSetup || needsLogin);

    query<HTMLHeadingElement>("#auth-title").textContent = needsSetup ? "Set up your local sign-in" : "Sign in";
    query<HTMLButtonElement>("#auth-submit").textContent = needsSetup ? "Create sign-in" : "Sign in";
    passcodeInput.setAttribute("autocomplete", needsSetup ? "new-password" : "current-password");

    const message = query<HTMLElement>("#auth-message");
    if ((needsSetup || needsLogin) && snapshot.error) {
      message.textContent = snapshot.error;
    } else if (!fieldErrors.username && !fieldErrors.passcode) {
      message.textContent = "";
    }
  };

  authState.subscribe(render);

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || (target.name !== "username" && target.name !== "passcode")) return;
    if (fieldErrors[target.name]) {
      delete fieldErrors[target.name];
      setFieldError(target.name, undefined);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const snapshot = authState.snapshot;
    const username = usernameInput.value;
    const passcode = passcodeInput.value;

    const result = snapshot.status === "needs-setup"
      ? await authState.setup(username, passcode)
      : await authState.login(username, passcode);

    if (result.kind === "invalid") {
      fieldErrors = result.errors;
      setFieldError("username", result.errors.username);
      setFieldError("passcode", result.errors.passcode);
      query<HTMLElement>("#auth-message").textContent = "Review the highlighted fields.";
      const firstInvalid = result.errors.username ? usernameInput : passcodeInput;
      firstInvalid.focus();
    } else if (result.kind === "failed") {
      fieldErrors = {};
      setFieldError("username", undefined);
      setFieldError("passcode", undefined);
      query<HTMLElement>("#auth-message").textContent = result.reason;
      passcodeInput.value = "";
      usernameInput.focus();
    } else {
      fieldErrors = {};
      usernameInput.value = "";
      passcodeInput.value = "";
    }
  });

  query<HTMLButtonElement>("#auth-retry").addEventListener("click", () => authState.load());
}

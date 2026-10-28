import "./styles.css";
import { ContactState, installUnsavedChangesWarning } from "./app/contact-state";
import { ContactRepository, createBrowserStoragePort } from "./storage/repository";
import { mountContactManager } from "./ui/contact-manager";

const repository = new ContactRepository(createBrowserStoragePort());
const state = new ContactState(repository);
const root = document.querySelector<HTMLElement>("#app");

if (!root) throw new Error("The application root is unavailable.");

mountContactManager(root, state, repository);
installUnsavedChangesWarning(state);
void state.load();
export const AUTH_SESSION_KEY = "contact-management:auth:session:v1";

export interface SessionPort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createBrowserSessionPort(): SessionPort {
  return {
    getItem(key) {
      return globalThis.sessionStorage.getItem(key);
    },
    setItem(key, value) {
      globalThis.sessionStorage.setItem(key, value);
    },
    removeItem(key) {
      globalThis.sessionStorage.removeItem(key);
    },
  };
}

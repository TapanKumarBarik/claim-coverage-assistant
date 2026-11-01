/** Web storage can be missing or throw (private mode, blocked cookies). These wrappers never throw. */
function guarded(getStore: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return getStore().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        getStore().setItem(key, value);
      } catch {
        /* the value just won't survive a refresh */
      }
    },
    remove(key: string): void {
      try {
        getStore().removeItem(key);
      } catch {
        /* nothing to clean up */
      }
    },
  };
}

/** Survives browser restarts: preferences. Nothing secret is ever stored in the browser. */
export const persistentStorage = guarded(() => localStorage);

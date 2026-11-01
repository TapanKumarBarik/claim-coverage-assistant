import { useCallback, useEffect, useState, type DependencyList } from "react";
import { ASYNC_STATUS } from "../constants/async";

export type ResourceState<T> =
  | { status: typeof ASYNC_STATUS.LOADING }
  | { status: typeof ASYNC_STATUS.ERROR; error: unknown }
  | { status: typeof ASYNC_STATUS.READY; data: T };

const LOADING = { status: ASYNC_STATUS.LOADING } as const;

export interface Resource<T> {
  state: ResourceState<T>;
  /** Fetch again without blanking the screen: the previous data stays visible until the new data arrives. */
  reload: () => void;
  /** Replace the data with a value already in hand (for example the response of a save). */
  setData: (data: T) => void;
}

/**
 * Load data when the component mounts and whenever `deps` change; the latest request wins.
 * `load` must only close over values listed in `deps`.
 */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>(LOADING);
  const [reloads, setReloads] = useState(0);

  // New inputs mean the old data is about to be wrong: show the loading state.
  useEffect(() => {
    setState(LOADING);
  }, deps);

  useEffect(() => {
    let current = true;
    load().then(
      (data) => current && setState({ status: ASYNC_STATUS.READY, data }),
      (error: unknown) => current && setState({ status: ASYNC_STATUS.ERROR, error }),
    );
    return () => {
      current = false;
    };
  }, [...deps, reloads]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);
  const setData = useCallback((data: T) => setState({ status: ASYNC_STATUS.READY, data }), []);
  return { state, reload, setData };
}

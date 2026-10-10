'use client';

import { useEffect, useRef, useState } from 'react';

/** Quiet time after typing before a text field saves. */
export const AUTOSAVE_DELAY_MS = 800;

export interface Autosave<V extends object> {
  /** The saved values with the edits that aren't saved yet on top. */
  values: V;
  /** Errors of edits that failed validation, keyed by field (or as `save` keys them). */
  errors: Readonly<Record<string, string>>;
  /** Changes a field. `immediate` saves at once (selects, pickers); otherwise after a pause. */
  set: <K extends keyof V>(field: K, value: V[K], options?: { immediate?: boolean }) => void;
  /** Saves pending edits now, e.g. when a text field loses focus. */
  flush: () => void;
}

type InFlight = Record<string, { value: unknown }>;

/**
 * Sends the valid changes and returns `{ field: message }` for the invalid ones. Calls `onSettled`
 * once the save has finished, or at once when nothing was sent. Settle from the `mutateAsync`
 * promise: `mutate`'s per-call callbacks only run for its latest call.
 */
export type AutosaveFn<V> = (changes: Partial<V>, onSettled: () => void) => Record<string, string>;

/**
 * Per-field autosave (FC-19). Edits are held on top of `saved` (the server's values, which update
 * optimistically and through Realtime) until they're saved. Invalid edits stay pending with their
 * errors, so the user can fix them. Sent edits stay shown until their save settles, because the
 * optimistic cache write lands a moment after the send; without this the old value flashes back.
 * Pending edits are saved when the component unmounts too.
 *
 * Error keys that aren't field names (e.g. `details.discCount`) are mapped back with `errorField`.
 */
export function useAutosave<V extends object>(
  saved: V,
  save: AutosaveFn<V>,
  errorField: (key: string) => string = (key) => key,
): Autosave<V> {
  const [pending, setPending] = useState<Partial<V>>({});
  // Sent edits by field; each send is its own object, so a later send of a field isn't cleared by an
  // earlier one settling.
  const [inFlight, setInFlight] = useState<InFlight>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pendingRef = useRef(pending);
  const inFlightRef = useRef(inFlight);
  const saveRef = useRef(save);
  const errorFieldRef = useRef(errorField);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    saveRef.current = save;
    errorFieldRef.current = errorField;
  });

  function updateInFlight(next: InFlight) {
    inFlightRef.current = next;
    setInFlight(next);
  }

  function flush() {
    clearTimeout(timer.current);
    const changes = pendingRef.current;
    if (Object.keys(changes).length === 0) return;

    const sent: InFlight = {};
    // Runs after `sent` is filled below, even when `onSettled` is called synchronously.
    const failed = saveRef.current(changes, () => queueMicrotask(settle));
    function settle() {
      const remaining = Object.fromEntries(
        Object.entries(inFlightRef.current).filter(
          ([field, entry]) => sent[field] === undefined || entry !== sent[field],
        ),
      );
      updateInFlight(remaining);
    }
    const failedFields = new Set(Object.keys(failed).map((key) => errorFieldRef.current(key)));
    const kept: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(changes)) {
      if (failedFields.has(field)) kept[field] = value;
      else sent[field] = { value };
    }
    updateInFlight({ ...inFlightRef.current, ...sent });
    pendingRef.current = kept as Partial<V>;
    setPending(kept as Partial<V>);
    setErrors(failed);
  }

  // Save what's left when the page goes away.
  useEffect(() => () => flush(), []);

  function set<K extends keyof V>(field: K, value: V[K], { immediate = false } = {}) {
    const next = { ...pendingRef.current, [field]: value };
    pendingRef.current = next;
    setPending(next);
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => errorFieldRef.current(key) !== field),
      ),
    );
    clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  const sentValues = Object.fromEntries(
    Object.entries(inFlight).map(([field, entry]) => [field, entry.value]),
  ) as Partial<V>;
  return { values: { ...saved, ...sentValues, ...pending }, errors, set, flush };
}

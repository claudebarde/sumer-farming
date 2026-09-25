export type ActionDeadline = {
  readonly reconcile: () => void;
  readonly cancel: () => void;
};

// Timers only wake the check; the server-provided timestamp decides completion.
// Reconcile on tab return because browsers can suspend background callbacks.
export const scheduleActionDeadline = (
  completesAt: number,
  complete: () => void
): ActionDeadline => {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => {
    finished = true;
    clearTimeout(timer);
  };
  const reconcile = (): void => {
    if (finished) return;
    clearTimeout(timer);
    const remaining = completesAt - Date.now();
    if (remaining > 0) {
      timer = setTimeout(reconcile, remaining);
      return;
    }
    finished = true;
    complete();
  };
  timer = setTimeout(reconcile, Math.max(0, completesAt - Date.now()));
  return { reconcile, cancel };
};

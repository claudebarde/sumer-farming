/** One source for both the cast gate and the short player-facing status. */
export const fishingReadiness = ({ pending, busy, arrivalMs, approachMs, cooldownMs }: {
  pending: boolean; busy: boolean; arrivalMs: number; approachMs: number; cooldownMs: number;
}) => {
  if (pending) return { ready: false, label: "Casting…" };
  if (busy || arrivalMs > 0) return { ready: false, label: "Getting ready…" };
  if (approachMs > 0) return { ready: false, label: `Fish approaching · ${Math.ceil(approachMs / 1000)}s` };
  if (cooldownMs > 0) return { ready: false, label: `Next cast in ${Math.ceil(cooldownMs / 1000)}s` };
  return { ready: true, label: "Ready to cast" };
};

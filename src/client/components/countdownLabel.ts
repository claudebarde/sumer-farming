/** Explicit units, with zero leading hours/minutes omitted. */
export const countdownLabel = (remainingMs: number): string => {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return `${hours > 0 ? `${hours}h ` : ""}${hours > 0 || minutes > 0 ? `${minutes}m ` : ""}${seconds % 60}s`;
};

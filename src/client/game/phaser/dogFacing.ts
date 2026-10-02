/** The dog artwork faces right by default; keep its facing when no mouse is present. */
export const dogFacingMouse = (dogX: number, mouseX: number | null, currentFlip: boolean): boolean =>
  mouseX === null || mouseX === dogX ? currentFlip : mouseX < dogX;

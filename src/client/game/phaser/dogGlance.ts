export type DogGlance =
  | { readonly type: "waiting"; readonly nextAt: number }
  | { readonly type: "looking"; readonly returnAt: number; readonly originalFlip: boolean };

export const advanceDogGlance = (
  state: DogGlance, now: number, sitting: boolean, flipX: boolean, nextDelay: number
): { readonly state: DogGlance; readonly flipX: boolean } => {
  if (!sitting || (state.type === "looking" && now >= state.returnAt)) {
    return { state: { type: "waiting", nextAt: now + nextDelay },
      flipX: state.type === "looking" ? state.originalFlip : flipX };
  }
  if (state.type === "waiting" && now >= state.nextAt) {
    return { state: { type: "looking", returnAt: now + 1_000, originalFlip: flipX }, flipX: !flipX };
  }
  return { state, flipX };
};

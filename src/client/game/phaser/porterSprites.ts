import empty from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-empty-idle.webp";
import empty1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-empty-walk-01.webp";
import empty2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-empty-walk-02.webp";
import bags from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-sacks-idle.webp";
import bags1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-bags-walk-01.webp";
import bags2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-bags-walk-02.webp";
import jars from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-jars-idle.webp";
import jars1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-jars-walk-01.webp";
import jars2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/porter/porter-jars-walk-02.webp";

export const PORTER_SOURCES = {
  "porter-empty-idle": empty, "porter-empty-walk-0": empty1, "porter-empty-walk-1": empty2,
  "porter-bags-idle": bags, "porter-bags-walk-0": bags1, "porter-bags-walk-1": bags2,
  "porter-jars-idle": jars, "porter-jars-walk-0": jars1, "porter-jars-walk-1": jars2,
} as const;

// Keep high-resolution detail without accentuating the artwork's dark outlines.
export const PORTER_TEXTURE_SIZE = 256;
export const PORTER_SHARPEN_AMOUNT = 0;
// The frame rises above his head. 72px gives his body ~56px, like the farmer,
// rather than fitting both the body and the frame into the farmer's body height.
export const PORTER_DISPLAY_SIZE = 72;

// Shared per-export registration: never resize each stride or cargo to its own silhouette.
export const porterFrameBounds = (key: string) => key.endsWith("idle")
  ? { left: 200, top: 81, right: 1014, bottom: 1214 }
  : { left: 300, top: 84, right: 1118, bottom: 1352 };

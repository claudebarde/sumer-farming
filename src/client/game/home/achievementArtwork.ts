import cup from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/furniture/golden-drinking-cup.png";
import chest from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/furniture/patterned-reed-storage-chest.png";
import pottery from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/furniture/fine-pottery-side-table.png";
import jar from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/furniture/painted-jar.png";
import { ACHIEVEMENT_TREASURES } from "../../../game-data/achievementTreasures";

export const ACHIEVEMENT_ARTWORK = {
  "golden-drinking-cup": cup,
  "patterned-reed-chest": chest,
  "fine-household-pottery-set": pottery,
  "painted-large-jar": jar,
} satisfies Record<typeof ACHIEVEMENT_TREASURES[number]["id"], string>;

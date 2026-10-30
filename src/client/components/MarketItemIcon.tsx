import sesame from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import dates from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";
import type { MarketItemKey } from "../../game-data/marketItems";
import { FARM_SPRITES } from "../../assets/farmSprites";
import MarketJarIcon from "./MarketJarIcon";
import tools from "../../assets/sprite_assets/pngs/wooden-baking-tools.webp";
import bread from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";

export default function MarketItemIcon({ itemKey }: { itemKey: MarketItemKey }) {
  if (itemKey === "beer" || itemKey === "emptyBeerJar" || itemKey === "brewingVessels") return <MarketJarIcon itemKey={itemKey} />;
  const images = { sesame, dates, barley: FARM_SPRITES.harvestedBarley, donkey: FARM_SPRITES.donkey, bakingTools: tools, bread, flour, brewersGroats: groats };
  return <img src={images[itemKey]} alt="" width={40} height={40} />;
}

import type { MarketItemKey } from "../../game-data/marketItems";
import { FARM_SPRITES } from "../../assets/farmSprites";
import MarketJarIcon from "./MarketJarIcon";
import tools from "../../assets/sprite_assets/pngs/wooden-baking-tools.png";
import bread from "../../assets/sprite_assets/pngs/bread-basket.png";
import flour from "../../assets/sprite_assets/pngs/flour-bags.png";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";

export default function MarketItemIcon({ itemKey }: { itemKey: MarketItemKey }) {
  if (itemKey === "beer" || itemKey === "emptyBeerJar" || itemKey === "brewingVessels") return <MarketJarIcon itemKey={itemKey} />;
  const images = { barley: FARM_SPRITES.harvestedBarley, donkey: FARM_SPRITES.donkey, bakingTools: tools, bread, flour, brewersGroats: groats };
  return <img src={images[itemKey]} alt="" width={40} height={40} />;
}

import barleyStand from '../../../assets/sprite_assets/pngs/v2/isometric-test/market-barley-isometric.webp';
import bakingStand from '../../../assets/sprite_assets/pngs/v2/isometric-test/market-baking-isometric.webp';
import beerStand from '../../../assets/sprite_assets/pngs/v2/isometric-test/market-beer-isometric.webp';
import produceStand from '../../../assets/sprite_assets/pngs/v2/isometric-test/fruit-vegetable-market-stand-isometric.png';
import suppliesStand from '../../../assets/sprite_assets/pngs/v2/isometric-test/supplies-equipment-market-stand-isometric.png';
import barley from '../../../assets/sprite_assets/pngs/wheat-sheaf.webp';
import sesame from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png';
import datePalm from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-ripe.webp';
import points from '../../../assets/sprite_assets/pngs/v2/isometric-test/icons/points-tokens-icon.png';
import farm from '../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical.png';
import granary from '../../../assets/sprite_assets/pngs/v2/isometric-test/granary-isometric-test.webp';
import mill from '../../../assets/sprite_assets/pngs/v2/isometric-test/mill-isometric.webp';
import oilMill from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/oil-mill-isometric-idle.png';
import oven from '../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-isometric.webp';
import brewery from '../../../assets/sprite_assets/pngs/v2/isometric-test/brewery-isometric.webp';
import shrine from '../../../assets/sprite_assets/pngs/v2/isometric-test/small-shrine-isometric.webp';
import warehouse from '../../../assets/sprite_assets/pngs/v2/isometric-test/warehouse-isometric.webp';
import kitchen from '../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/kitchen-interior-matched.png';
import market from '../../../assets/sprite_assets/pngs/v2/isometric-test/market-isometric-test.webp';
import merchantBoat from '../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-boat/merchant-reed-boat-idle.png';
import ziggurat from '../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-completed.png';

/** Reuse the approved game artwork without loading the game scene. */
export const RULE_ARTWORK: Readonly<Record<string, { src: string; alt: string }>> = {
  'market-stand-barley': { src: barleyStand, alt: 'Barley market stand' },
  'market-stand-baking': { src: bakingStand, alt: 'Baking market stand' },
  'market-stand-beer': { src: beerStand, alt: 'Beer market stand' },
  'market-stand-produce': { src: produceStand, alt: 'Produce and provisions stand' },
  'market-stand-supplies': { src: suppliesStand, alt: 'Supplies and equipment stand' },
  barley: { src: barley, alt: 'Barley' },
  sesame: { src: sesame, alt: 'Basket of sesame seeds' },
  'date-palm': { src: datePalm, alt: 'Fruit-bearing date palm' },
  points: { src: points, alt: 'Points tokens' },
  farm: { src: farm, alt: 'Farmhouse' },
  granary: { src: granary, alt: 'Granary' },
  mill: { src: mill, alt: 'Flour and groats mill' },
  'oil-mill': { src: oilMill, alt: 'Oil mill' },
  'bread-oven': { src: oven, alt: 'Bread oven' },
  brewery: { src: brewery, alt: 'Brewery' },
  'small-shrine': { src: shrine, alt: 'Small shrine' },
  warehouse: { src: warehouse, alt: 'Warehouse' },
  kitchen: { src: kitchen, alt: 'Kitchen' },
  market: { src: market, alt: 'Market' },
  merchant: { src: merchantBoat, alt: 'Merchant boat' },
  ziggurat: { src: ziggurat, alt: 'Completed ziggurat' },
};

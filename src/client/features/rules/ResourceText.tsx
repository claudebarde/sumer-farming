import { FARM_SPRITES } from '../../../assets/farmSprites';
import { MEAL_ICONS } from '../../components/mealIcons';
import sesame from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png';
import oil from '../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/jar-oil-single.png';
import dates from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp';
import flour from '../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp';
import groats from '../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp';
import emptyJars from '../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/jar-empty-single.png';
import brewingJars from '../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-left-bottom-jar.png';
import shekels from '../../../assets/sprite_assets/pngs/shekels.webp';
import tools from '../../../assets/sprite_assets/pngs/wooden-baking-tools.webp';
import styles from './RulesPage.module.scss';

const icons: Readonly<Record<string, string>> = {
  'oil-fried barley cakes': MEAL_ICONS.barleyCakes,
  'date cakes': MEAL_ICONS.dateCakes,
  'sesame cakes': MEAL_ICONS.sesameCakes,
  'date and sesame porridge': MEAL_ICONS.porridge,
  'empty jars': emptyJars, 'empty jar': emptyJars,
  'brewing jars': brewingJars, 'brewing jar': brewingJars,
  'baking tools': tools,
  "brewer's groats": groats, groats,
  'mill donkey': FARM_SPRITES.donkey, donkey: FARM_SPRITES.donkey,
  barley: FARM_SPRITES.harvestedBarley, bread: FARM_SPRITES.breadBasket,
  beer: FARM_SPRITES.beerJars, reeds: FARM_SPRITES.reedBundle,
  clay: FARM_SPRITES.brickPile, sesame, oil, dates, flour, shekels,
};
// Longest names first so a meal is represented by its own icon, not its ingredients.
const terms = Object.keys(icons).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');

/** Keep resource names readable and accessible; the accompanying artwork is decorative. */
export default function ResourceText({ children, section, table = false }: { children: string | number; section: string; table?: boolean }) {
  if ((!section.startsWith('market-stand-') && !['warehouse', 'market', 'kitchen', 'construction', 'contributions'].includes(section)) || typeof children !== 'string') return <>{children}</>;
  return <>{children.split(pattern).map((part, index) => {
    const icon = icons[part.toLowerCase()];
    return icon ? <span key={index} className={`${styles.resourceWord} ${table ? styles.tableResource : ''}`}><img src={icon} alt="" width={table ? 32 : 24} height={table ? 32 : 24} loading="lazy" />{part}</span> : part;
  })}</>;
}

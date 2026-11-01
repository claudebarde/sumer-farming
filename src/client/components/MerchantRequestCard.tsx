import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import brewersGroats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";
import bread from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import dates from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";
import sesame from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import oil from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/jar-oil-single.png";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import type { NpcRequests } from "../../schemas/npcRequests";
import { canDeliverRequest } from "../../game-core/market/npcRequests";
import { FARM_SPRITES } from "../../assets/farmSprites";
import beer from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/jar-beer-single.png";
import shekels from "../../assets/sprite_assets/pngs/shekels.webp";
import styles from "../styles/MerchantRequests.module.scss";

export default function MerchantRequestCard({ request, stock, pending, onDeliver }: {
  readonly request: NpcRequests["requests"][number];
  readonly stock: NpcRequests["stock"];
  readonly pending: boolean;
  readonly onDeliver: () => void;
}) {
  const enough = canDeliverRequest(request, stock);
  const goods = [
    { name: "Barley", image: FARM_SPRITES.harvestedBarley, needed: request.barley, stored: stock.barley },
    { name: "Beer", image: beer, needed: request.beer, stored: stock.beer },
    { name: "Flour", image: flour, needed: request.flour ?? 0, stored: stock.flour ?? 0 },
    { name: "Groats", image: brewersGroats, needed: request.brewersGroats ?? 0, stored: stock.brewersGroats ?? 0 },
    { name: "Bread", image: bread, needed: request.bread ?? 0, stored: stock.bread ?? 0 },
    { name: "Dates", image: dates, needed: request.dates ?? 0, stored: stock.dates ?? 0 },
    { name: "Sesame", image: sesame, needed: request.sesame ?? 0, stored: stock.sesame ?? 0 },
    { name: "Oil", image: oil, needed: request.oil ?? 0, stored: stock.oil ?? 0 },

  ].filter(good => good.needed > 0);
  return <section className={styles.card} aria-label={request.customer}>
    <div className={styles.artwork} aria-hidden="true">
      {goods.map(good => <img key={good.name} src={good.image} alt="" draggable={false} />)}
    </div>
    <div className={styles.content}>
      <h3>{request.customer}</h3>
      <p className={styles.story}>{request.description}</p>
      <div className={styles.goods}>
        {goods.map(good => <div className={styles.good} key={good.name}>
          <span className={styles.needed}><img src={good.image} alt="" width={28} height={28} /><strong>{good.name}</strong><span>{good.needed} needed</span></span>
          <span className={styles.stock} data-enough={good.stored >= good.needed}>You have <strong>{good.stored}</strong></span>
        </div>)}
      </div>
      {!request.completed && enough && request.barley > 0 && stock.barley - request.barley < 1 &&
        <p className={styles.note} role="note">This delivery would leave no barley for the farmer’s next ration.</p>}
      {!request.completed && !enough && <p className={styles.note}>Store the missing goods to deliver this request.</p>}
      <div className={styles.footer}>
        <div className={styles.reward}><img src={shekels} alt="" width={36} height={36} /><span><small>Reward</small><strong>{request.reward} shekels</strong></span></div>
        {request.completed ? <strong className={styles.delivered}>Delivered ✓</strong> :
          <button className={actionStyles.button} disabled={!enough || pending} onClick={onDeliver}
            aria-label={`Deliver to ${request.customer} for ${request.reward} shekels`}>{goods.map(good => <span key={good.name} className={actionStyles.icon} aria-hidden="true"><img src={good.image} alt="" draggable={false} /></span>)}<span>
            {pending ? "Delivering…" : "Deliver"}
          </span></button>}
      </div>
    </div>
  </section>;
}

import type { FarmSnapshot } from "../../schemas/farm";
import miniature from "../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-completed.png";
import patron from "../../assets/sprite_assets/pngs/v2/isometric-test/badges/ziggurat-patron.png";
import actions from "../styles/BuildingActionButton.module.scss";
export default function DecorationsPanel({snapshot,onPlace,onStore,pending}:{snapshot:FarmSnapshot;onPlace:(id:string)=>void;onStore:(id:string)=>void;pending:boolean}) {
 return <section><h2>Decorations</h2>{snapshot.rewards.length===0?<p>No decorations earned yet.</p>:<>
 <p><img src={patron} width={40} height={40} alt="Ziggurat Patron"/> Ziggurat Patron</p>
 {snapshot.rewards.map(reward=><div key={reward.id}><h3>Miniature ziggurat</h3>
 <button className={actions.button} disabled={pending} onClick={()=>reward.objectId?onStore(reward.id):onPlace(reward.id)}>
 <img src={miniature} width={48} height={48} alt=""/><span>{reward.objectId?"Return to storage":"Place decoration"}</span></button></div>)}
 </>}</section>;
}

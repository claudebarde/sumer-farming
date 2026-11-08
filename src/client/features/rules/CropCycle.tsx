import sown from '../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-sown.png';
import barleyGrowing from '../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-growing.png';
import barleyRipe from '../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-ripe.png';
import barleyWithering from '../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-withering.png';
import ground from '../../../assets/sprite_assets/pngs/v2/isometric-test/ground-arable.webp';
import sesameYoung from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-young.png';
import sesameGrowing from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-growing.png';
import sesameFlowering from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-flowering.png';
import sesameRipe from '../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-ripe.png';
import palmSapling from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-sapling.webp';
import palmGrown from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.webp';
import palmFlowering from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-flowering.webp';
import palmRipe from '../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-ripe.webp';
import styles from './RulesPage.module.scss';

type CropCycleDefinition = Readonly<{
  stages: readonly (readonly [label: string, image: string])[];
  note?: string;
}>;
const cycles: Readonly<Record<string, CropCycleDefinition>> = {
  barley: {
    stages: [['Seeds', sown], ['Growing', barleyGrowing], ['Ripe', barleyRipe], ['Withered', barleyWithering], ['Cleared', ground]],
    note: 'Withering and automatic clearing apply to barley planted from level 10 onward, if left unharvested.',
  },
  sesame: {
    stages: [['Seeds', sown], ['Young plants', sesameYoung], ['Growing', sesameGrowing], ['Flowering', sesameFlowering], ['Ripe', sesameRipe]],
  },
  'date-palm': {
    stages: [['Sapling', palmSapling], ['Mature palm', palmGrown], ['Flowering', palmFlowering], ['Ripe dates', palmRipe]],
    note: 'After harvesting, the mature palm begins another fruit-growing cycle.',
  },
};

export default function CropCycle({ section }: { section: string }) {
  const cycle = cycles[section];
  if (!cycle) return null;
  return <figure className={styles.cropCycle}>
    <figcaption>Growing cycle</figcaption>
    <div className={styles.cycleScroll} tabIndex={0} role="region" aria-label="Growing cycle stages">
      <ol className={styles.cycleStages}>
        {cycle.stages.map(([label, image], index) => <li key={label}>
          {index > 0 && <span className={styles.cycleArrow} aria-hidden="true">→</span>}
          <div><img src={image} alt="" width={96} height={96} loading="lazy" decoding="async" /><span>{label}</span></div>
        </li>)}
      </ol>
    </div>
    {cycle.note && <p className={styles.cycleNote}>{cycle.note}</p>}
  </figure>;
}

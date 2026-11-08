import { useEffect, useState } from 'react';
import { RULE_SECTIONS, BUILDING_QUICK_REFERENCE } from './guide';
import { RULE_ARTWORK } from './artwork';
import { GUIDE_NAVIGATION } from './navigation';
import ResourceText from './ResourceText';
import CropCycle from './CropCycle';
import scribe from '../../../assets/sprite_assets/pngs/v2/isometric-test/icons/guide-scribe.png';
import styles from './RulesPage.module.scss';
import titleImage from '../../../assets/sprite_assets/pngs/v2/isometric-test/title.png';

export default function RulesPage() {
  const [query, setQuery] = useState('');
  const visible = RULE_SECTIONS.filter(section => `${section.title} ${section.paragraphs.join(' ')} ${section.rows?.flat().join(' ') ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    document.title = 'Game rules · Fields of Sumer';
    const jump = () => {
      const id = window.location.hash.slice(1);
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    };
    const frame = requestAnimationFrame(jump);
    window.addEventListener('hashchange', jump);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', jump); };
  }, []);
  return <div className={styles.page}>
    <header><img src={titleImage} alt="Fields of Sumer" /><div className={styles.guideHeading}><img src={scribe} alt="" className={styles.scribe} width={64} height={64} /><h1>Game rules</h1></div><span>Keep your game open in its original tab.</span></header>
    <div className={styles.layout}>
      <nav aria-label="Rules contents"><label htmlFor="rules-search">Find a rule</label><input id="rules-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search rules…" />
        <a href="#rules-content" className={styles.skip}>Skip to rules</a>
        {GUIDE_NAVIGATION.map(group => {
          const links = group.sections.flatMap(id => visible.filter(section => section.id === id));
          if (links.length === 0) return null;
          return <div className={styles.navGroup} key={group.title}>
            <h2>{group.title}</h2>
            <ul>{links.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul>
          </div>;
        })}
      </nav>
      <main id="rules-content" tabIndex={-1}>
        {visible.length === 0 && <p role="status">No matching rules. Try another word.</p>}
        {visible.map(section => <section key={section.id} id={section.id} className={section.id.startsWith('market-stand-') ? styles.marketStand : undefined} aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`}>{section.title}</h2>
          <div className={styles.description}>
            {RULE_ARTWORK[section.id] && <img className={styles.building} src={RULE_ARTWORK[section.id]!.src} alt={RULE_ARTWORK[section.id]!.alt} width={180} height={180} loading="lazy" decoding="async" />}
            {BUILDING_QUICK_REFERENCE[section.id] && <ul className={styles.quickReference}>
              <li><strong>Unlocks:</strong> {BUILDING_QUICK_REFERENCE[section.id]!.unlock}</li>
              <li><strong>Construction materials:</strong> <ResourceText section={section.id}>{BUILDING_QUICK_REFERENCE[section.id]!.materials}</ResourceText></li>
            </ul>}
            {section.paragraphs.map(paragraph => <p key={paragraph}><ResourceText section={section.id}>{paragraph}</ResourceText></p>)}
          </div>
          {section.rows && <div className={styles.table}><table><caption>{section.title} reference</caption><thead><tr>{section.columns?.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{section.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th key={column} scope="row"><ResourceText section={section.id} table>{cell}</ResourceText></th> : <td key={column}><ResourceText section={section.id} table>{cell}</ResourceText></td>)}</tr>)}</tbody></table></div>}
          <CropCycle section={section.id} />
        </section>)}
      </main>
    </div>
  </div>;
}

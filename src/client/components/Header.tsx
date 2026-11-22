import { useId } from "react";
import styles from "../styles/Header.module.scss";
import titleImage from "../../assets/sprite_assets/pngs/v2/isometric-test/title.png";
import completedFarm from "../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical.png";

const Header = () => {
  const accountNoteId = useId();
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <img src={titleImage} alt="Fields of Sumer" width={2172} height={724} />
      </h1>
      <div className={styles.accountActions} role="group" aria-label="Account">
        <button type="button" className={`${styles.accountButton} ${styles.loginButton}`} aria-disabled="true" aria-describedby={accountNoteId}>
          <img src={completedFarm} alt="" width={52} height={52} />
          <span>Log in</span>
        </button>
        <button type="button" className={styles.accountButton} aria-disabled="true" aria-describedby={accountNoteId}>
          <span>Create account</span>
        </button>
        <span id={accountNoteId} className={styles.visuallyHidden}>Visual preview. Account access is not available yet.</span>
      </div>
    </header>
  );
};

export default Header;

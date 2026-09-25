import styles from "../styles/Header.module.scss";
import DevelopmentPlayerSelector from "./DevelopmentPlayerSelector";

const Header = () => {
  return (
    <header className={styles.header}>
      <h1>Welcome to Sumer Farming</h1>
      <DevelopmentPlayerSelector />
    </header>
  );
};

export default Header;

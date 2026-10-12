import styles from "../styles/Header.module.scss";
import DevelopmentPlayerSelector from "./DevelopmentPlayerSelector";

const Header = () => {
  const view = new URLSearchParams(window.location.search).get("view") ?? "flat";
  const isometric = view === "isometric-farm" || view === "isometric";
  return (
    <header className={styles.header}>
      <h1>A Home Between Rivers</h1>
      <DevelopmentPlayerSelector />
      <label>View{" "}
        <select value={view}
          onChange={event => {
            const url = new URL(window.location.href);
            if (event.target.value !== "flat") url.searchParams.set("view", event.target.value);
            else url.searchParams.delete("view");
            window.location.assign(url);
          }}>
          {!isometric && <option value="flat">Flat farm</option>}
          <option value="isometric-farm">Isometric farm (preview)</option>
          <option value="isometric">Isometric test</option>
        </select>
      </label>
    </header>
  );
};

export default Header;

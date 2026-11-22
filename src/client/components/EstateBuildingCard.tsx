import type { ReactNode } from "react";
import styles from "../styles/GameCanvas.module.scss";

/** Shared catalogue presentation; each view supplies its placement action. */
export default function EstateBuildingCard({
  name,
  image,
  artwork,
  children
}: {
  readonly name: string;
  readonly image: string;
  readonly artwork?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <li className={styles["building-card"]}>
      {artwork ?? <img src={image} alt="" width={160} height={160} draggable={false} />}
      <h3>{name}</h3>
      {children}
    </li>
  );
}

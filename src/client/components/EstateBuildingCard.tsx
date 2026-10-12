import type { ReactNode } from "react";
import styles from "../styles/GameCanvas.module.scss";

/** Shared catalogue presentation; each view supplies its placement action. */
export default function EstateBuildingCard({
  name,
  image,
  children
}: {
  readonly name: string;
  readonly image: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={styles["building-card"]}>
      <img src={image} alt="" width={160} height={160} draggable={false} />
      <h3>{name}</h3>
      {children}
    </li>
  );
}

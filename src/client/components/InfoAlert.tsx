import type { ReactNode } from "react";
import styles from "../styles/InfoAlert.module.scss";

/** Approved informational-message design. Use for non-urgent UI guidance. */
export default function InfoAlert({ children, role = "status" }: {
  children: ReactNode;
  role?: "status" | "alert";
}) {
  return <p className={styles.alert} role={role}>{children}</p>;
}

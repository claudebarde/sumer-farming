import { useContext, type ComponentProps } from "react";
import { TileActionsBusy } from "./tileActionsBusy";

/** Only tile actions inherit this state; popup navigation and closing stay usable. */
export default function TileActionButton({ children, disabled, onClick, ...props }: ComponentProps<"button">) {
  const busy = useContext(TileActionsBusy);
  if (busy) return null;
  return <button {...props} disabled={disabled} onClick={onClick}>
    {children}
  </button>;
}

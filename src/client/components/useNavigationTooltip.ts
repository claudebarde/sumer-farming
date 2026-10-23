import { useEffect, useRef, useState } from "react";

/** Restored browser focus is not a request to show a tooltip. */
export function useNavigationTooltip() {
  const [open, setOpen] = useState<string | null>(null);
  const interacted = useRef(true);
  useEffect(() => {
    const suspend = () => { interacted.current = false; setOpen(null); };
    const pointer = (event: PointerEvent) => {
      if (event.isTrusted && (event.movementX !== 0 || event.movementY !== 0)) interacted.current = true;
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.isTrusted && !event.altKey && !event.metaKey && !event.ctrlKey && event.key === "Tab") interacted.current = true;
    };
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", suspend);
    document.addEventListener("visibilitychange", suspend);
    document.addEventListener("pointermove", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", suspend);
      document.removeEventListener("visibilitychange", suspend);
      document.removeEventListener("pointermove", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);
  return (id: string) => ({
    open: open === id,
    onOpenChange: (next: boolean) => {
      if (!next) setOpen(current => current === id ? null : current);
      else if (interacted.current && document.visibilityState === "visible" && document.hasFocus()) setOpen(id);
    },
  });
}

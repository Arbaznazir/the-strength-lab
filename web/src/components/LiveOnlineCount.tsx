"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  className?: string;
};

/** Smoothly animates online count shifts between API polls. */
export function LiveOnlineCount({ value, className = "" }: Props) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (displayRef.current === value) return;
    const start = displayRef.current;
    const delta = value - start;
    const steps = 12;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(id);
        return;
      }
      setDisplay(Math.round(start + (delta * step) / steps));
    }, 45);
    return () => clearInterval(id);
  }, [value]);

  return (
    <span
      className={`font-semibold tabular-nums tracking-tight text-[var(--accent)] ${className}`}
    >
      {display.toLocaleString("en-US")}
    </span>
  );
}

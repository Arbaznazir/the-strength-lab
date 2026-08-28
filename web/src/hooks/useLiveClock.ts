"use client";

import { useEffect, useState } from "react";

/** Re-render on an interval so relative timestamps ("5 minutes ago") stay current. */
export function useLiveClock(intervalMs = 30_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

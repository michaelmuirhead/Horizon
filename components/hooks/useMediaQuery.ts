"use client";

import { useEffect, useState } from "react";

// Reactive matchMedia. Returns false on the server / first render so that
// the SSR'd HTML always reflects the phone layout — components can opt into
// wider behavior once mounted on the client.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

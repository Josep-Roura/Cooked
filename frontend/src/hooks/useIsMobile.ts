"use client";

import { useEffect, useState } from "react";

export function useIsMobile(breakpointPx: number = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < breakpointPx);
    }

    update(); // inicial
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpointPx]);

  return isMobile;
}

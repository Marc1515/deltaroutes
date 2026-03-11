"use client";

import { useEffect, useState } from "react";

const MINIMUM_VISIBLE_MS = 1000;

export function AppLoadingOverlay() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const startTime = Date.now();

    const hideOverlay = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(MINIMUM_VISIBLE_MS - elapsed, 0);

      window.setTimeout(() => {
        setIsVisible(false);
      }, remaining);
    };

    if (document.readyState === "complete") {
      hideOverlay();
      return;
    }

    window.addEventListener("load", hideOverlay, { once: true });

    return () => {
      window.removeEventListener("load", hideOverlay);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      aria-label="Cargando contenido"
      aria-live="polite"
      className="app-loading-overlay"
      role="status"
    >
      <div className="app-loading-spinner" />
    </div>
  );
}

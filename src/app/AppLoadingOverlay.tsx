"use client";

import { useEffect, useState } from "react";

const MINIMUM_VISIBLE_MS = 1000;
const POST_LOAD_SETTLE_MS = 250;
const EXIT_TRANSITION_MS = 650;

export function AppLoadingOverlay() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    let hideTimeoutId: number | undefined;
    let unmountTimeoutId: number | undefined;
    let exitAnimationFrameId = 0;

    const startExit = () => {
      exitAnimationFrameId = window.requestAnimationFrame(() => {
        exitAnimationFrameId = window.requestAnimationFrame(() => {
          setIsExiting(true);
          unmountTimeoutId = window.setTimeout(() => {
            setIsVisible(false);
          }, EXIT_TRANSITION_MS);
        });
      });
    };

    const hideOverlay = () => {
      const elapsed = Date.now() - startTime;
      const minimumRemaining = Math.max(MINIMUM_VISIBLE_MS - elapsed, 0);
      const remaining = minimumRemaining + POST_LOAD_SETTLE_MS;

      hideTimeoutId = window.setTimeout(() => {
        startExit();
      }, remaining);
    };

    if (document.readyState === "complete") {
      hideOverlay();
      return () => {
        if (hideTimeoutId) window.clearTimeout(hideTimeoutId);
        if (unmountTimeoutId) window.clearTimeout(unmountTimeoutId);
        if (exitAnimationFrameId) {
          window.cancelAnimationFrame(exitAnimationFrameId);
        }
      };
    }

    window.addEventListener("load", hideOverlay, { once: true });

    return () => {
      window.removeEventListener("load", hideOverlay);
      if (hideTimeoutId) window.clearTimeout(hideTimeoutId);
      if (unmountTimeoutId) window.clearTimeout(unmountTimeoutId);
      if (exitAnimationFrameId) {
        window.cancelAnimationFrame(exitAnimationFrameId);
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      aria-label="Cargando contenido"
      aria-live="polite"
      className={`app-loading-overlay${
        isExiting ? " app-loading-overlay--exiting" : ""
      }`}
      role="status"
    >
      <div className="app-loading-indicator">
        <div className="app-loading-spinner" />
      </div>
    </div>
  );
}

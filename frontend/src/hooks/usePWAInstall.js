import { useCallback, useEffect, useState } from "react";

/**
 * True if the app is currently running as an installed PWA —
 * covers the standard Display Mode Media Query and the older
 * iOS Safari `navigator.standalone` flag.
 */
function isRunningStandalone() {
  if (typeof window === "undefined") return false;
  const matchesDisplayMode =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = window.navigator?.standalone === true;
  return Boolean(matchesDisplayMode || isIosStandalone);
}

/**
 * Wraps the native `beforeinstallprompt` / `appinstalled` PWA install flow.
 *
 * - Captures and defers the browser's install prompt so it can be
 *   triggered later from a UI element (button, menu item, etc.).
 * - Tracks whether the app is already installed/running standalone,
 *   so consumers know to hide any "Install" affordance.
 * - On unsupported browsers (e.g. iOS Safari, which never fires
 *   `beforeinstallprompt`), `canInstall` simply stays false — no
 *   errors, no fake prompt.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);

  useEffect(() => {
    if (isInstalled) return undefined;

    function handleBeforeInstallPrompt(event) {
      // Prevent the browser's default mini-infobar/prompt so we can
      // trigger it ourselves from our own UI.
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Some browsers only update matchMedia after install completes;
    // keep isInstalled in sync if display-mode changes underneath us.
    const displayModeQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    function handleDisplayModeChange(event) {
      if (event.matches) setIsInstalled(true);
    }
    displayModeQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModeQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    // The captured prompt event can only be used once.
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setIsInstalled(true);

    return choice.outcome;
  }, [deferredPrompt]);

  return {
    // Only true once the browser has actually offered an install
    // prompt and the app isn't already installed.
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    promptInstall,
  };
}

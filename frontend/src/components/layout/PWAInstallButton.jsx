import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * "Install ClarityCare" button, wired to the native browser PWA
 * install flow via `usePWAInstall`.
 *
 * Renders nothing unless the browser has actually offered an install
 * prompt (`beforeinstallprompt`) and the app isn't already installed —
 * so it never appears as a dead/fake button on browsers that don't
 * support installation (e.g. iOS Safari).
 */
export default function PWAInstallButton() {
  const { t } = useTranslation();
  const { canInstall, promptInstall } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={promptInstall}
      aria-label={t("navbar.installApp")}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t("navbar.installApp")}</span>
    </Button>
  );
}

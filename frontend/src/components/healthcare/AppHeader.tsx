import { Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Page banner for the Results/Workspace screen. Dark/light mode and the
 * language switcher now live in the shared top navbar (AppLayout), so this
 * only renders the page-specific title — it no longer owns its own theme
 * toggle/state.
 */
export function AppHeader() {
  const { t } = useTranslation();

  return (
    <header className="border-b bg-card">
      <div className="container flex items-center gap-3 py-6 sm:py-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--ai))] text-primary-foreground">
          <Stethoscope className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {t("results.appHeader.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("results.appHeader.subtitle")}
          </p>
        </div>
      </div>
    </header>
  );
}

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

/**
 * Top-of-app language switcher. Wraps the existing i18next instance —
 * `i18n.changeLanguage` already persists the choice to localStorage and
 * survives navigation (see src/i18n/config.js), so this component only
 * needs to render the options and call it.
 */
export default function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2.5 text-foreground"
          aria-label={t("navbar.selectLanguage")}
        >
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="hidden text-sm font-medium sm:inline">
            {current.nativeLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={
              lang.code === current.code
                ? "bg-secondary text-secondary-foreground"
                : ""
            }
          >
            {lang.nativeLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

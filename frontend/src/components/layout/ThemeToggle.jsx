import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? t("results.appHeader.switchToLight")
          : t("results.appHeader.switchToDark")
      }
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-warning" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </Button>
  );
}

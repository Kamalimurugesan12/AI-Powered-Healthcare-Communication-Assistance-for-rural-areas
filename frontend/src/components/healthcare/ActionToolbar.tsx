import { Languages, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActionToolbarProps {
  language: string;
  onLanguageChange: (value: string) => void;
  onTranslate: () => void;
  onSimplify: () => void;
  translateDisabled?: boolean;
}

// Kept in sync with the backend's SUPPORTED_LANGUAGES
// (app/services/translation_service.py): en, ta, kn, te, hi.
// Note: this selector controls which language the *medical report content*
// is translated into (via the backend translation service) — it is
// intentionally independent of the application's UI language.
const LANGUAGE_CODES = ["en", "hi", "te", "kn", "ta"];

export function ActionToolbar({ language, onLanguageChange, onTranslate, onSimplify, translateDisabled }: ActionToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between w-full p-4 mb-6 rounded-2xl bg-card border border-primary/10 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">

      {/* Left Side: Language Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
          <Languages className="w-4 h-4" />
          <span>{t("results.toolbar.translateTo")}</span>
        </div>

        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[140px] h-11 bg-background border-border">
            <SelectValue placeholder={t("results.toolbar.selectLanguage")} />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">{code}</span>
                  <span>{t(`common.languages.${code}`)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-3 mt-4 md:mt-0">
        <Button onClick={onSimplify} variant="outline" className="h-11 flex items-center gap-2 hover:bg-secondary text-foreground">
          <Sparkles className="w-4 h-4" />
          {t("results.toolbar.simplify")}
        </Button>
        <Button onClick={onTranslate} disabled={translateDisabled} className="h-11 flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Languages className="w-4 h-4" />
          {t("results.toolbar.translate")}
        </Button>
      </div>

    </div>
  );
}

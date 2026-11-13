import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <HeartPulse className="h-14 w-14 text-primary" />
      <h1 className="font-display text-4xl text-foreground">{t("notFound.code")}</h1>
      <p className="max-w-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Button asChild>
        <Link to="/home">{t("notFound.backToDashboard")}</Link>
      </Button>
    </div>
  );
}

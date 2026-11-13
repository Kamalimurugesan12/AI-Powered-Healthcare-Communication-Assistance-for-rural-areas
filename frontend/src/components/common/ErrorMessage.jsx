import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ErrorMessage({ message }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 flex gap-2">
      <AlertTriangle className="text-destructive" />
      <p>{message ?? t("common.somethingWentWrong")}</p>
    </div>
  );
}

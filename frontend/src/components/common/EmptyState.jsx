import { FileX } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function EmptyState({ title, description }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <FileX className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title ?? t("history.emptyTitle")}</h3>
      <p className="text-sm text-muted-foreground">{description ?? t("history.emptyDescription")}</p>
    </div>
  );
}

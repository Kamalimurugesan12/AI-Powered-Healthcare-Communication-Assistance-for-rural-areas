import { useTranslation } from "react-i18next";

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const resolved = status ?? t("common.processed");
  const c =
    resolved === "Completed" || resolved === t("common.processed")
      ? "bg-success text-success-foreground"
      : "bg-warning text-warning-foreground";
  return <span className={`rounded-full px-3 py-1 text-xs ${c}`}>{resolved}</span>;
}

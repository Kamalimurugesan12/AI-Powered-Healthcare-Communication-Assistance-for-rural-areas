import { useTranslation } from "react-i18next";

export default function Loader({ text }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="mt-3 text-sm text-muted-foreground">{text ?? t("common.loading")}</p>
    </div>
  );
}

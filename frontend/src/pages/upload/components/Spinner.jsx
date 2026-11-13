import { useTranslation } from "react-i18next";

function Spinner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 text-primary mb-3">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span>{t("upload.extracting")}</span>
    </div>
  );
}

export default Spinner;

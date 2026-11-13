import { useTranslation } from "react-i18next";

function Header() {
  const { t } = useTranslation();
  return (
    <header className="bg-gradient-to-r from-primary to-primary-deep text-primary-foreground py-6 px-4 text-center shadow-md">
      <h1 className="text-3xl font-bold">{t("upload.headerTitle")}</h1>
      <p className="text-primary-foreground/80 mt-1">{t("upload.headerSubtitle")}</p>
    </header>
  );
}

export default Header;

import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t p-4 text-center text-sm text-muted-foreground">
      {t("footer.copyright")}
    </footer>
  );
}

import { useTranslation } from "react-i18next";

export default function Navbar() {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between border-b bg-background p-4">
      <h1 className="font-display text-xl">{t("navbar.title")}</h1>
    </header>
  );
}

import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import LanguageSelector from "@/components/layout/LanguageSelector";
import ThemeToggle from "@/components/layout/ThemeToggle";
import PWAInstallButton from "@/components/layout/PWAInstallButton";
import { useAuth } from "@/contexts/AuthContext";

function usePageTitle() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  if (pathname.startsWith("/home")) return t("bottomNav.home");
  if (pathname.startsWith("/upload")) return t("bottomNav.upload");
  if (pathname.startsWith("/history") || pathname.startsWith("/prescription"))
    return t("bottomNav.history");
  if (pathname.startsWith("/chatbot")) return t("bottomNav.chat");
  if (pathname.startsWith("/profile")) return t("bottomNav.profile");
  if (pathname.startsWith("/results")) return t("results.header.title");
  return t("navbar.title");
}

export default function TopNavbar({ onOpenSidebar }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const title = usePageTitle();

  const initials = (user?.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t("navbar.toggleMenu")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/70 hover:bg-secondary hover:text-secondary-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h1>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <PWAInstallButton />
        <LanguageSelector />
        <ThemeToggle />
        <Link
          to="/profile"
          aria-label={t("bottomNav.profile")}
          className="ml-1 rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--ai))] text-xs font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}

import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home as HomeIcon,
  Upload as UploadIcon,
  History as HistoryIcon,
  MessageSquare,
  User,
  Stethoscope,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { APP } from "@/constants/app";

function useNavItems() {
  const { t } = useTranslation();
  return [
    { to: "/home", label: t("bottomNav.home"), icon: HomeIcon },
    { to: "/upload", label: t("bottomNav.upload"), icon: UploadIcon },
    { to: "/history", label: t("bottomNav.history"), icon: HistoryIcon },
    { to: "/chatbot", label: t("bottomNav.chat"), icon: MessageSquare },
    { to: "/profile", label: t("bottomNav.profile"), icon: User },
  ];
}

function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-2.5 px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--ai))] text-primary-foreground shadow-sm">
        <Stethoscope className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground">
        {APP.NAME}
      </span>
    </div>
  );
}

function NavItems({ onNavigate }) {
  const items = useNavItems();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-gradient-to-r from-primary to-[hsl(var(--ai))] text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-sidebar-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive
                    ? "text-primary-foreground"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
                aria-hidden="true"
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Fixed left sidebar shown on desktop/tablet (lg and up). */
export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <SidebarBrand />
      <NavItems />
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">
        {APP.TAGLINE}
      </div>
    </aside>
  );
}

/** Slide-out drawer sidebar shown on mobile/tablet when toggled from the top navbar. */
export function MobileSidebarDrawer({ open, onClose }) {
  const { t } = useTranslation();

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 transition-opacity lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-floating transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border pr-2">
          <SidebarBrand />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-muted hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <NavItems onNavigate={onClose} />
      </aside>
    </Fragment>
  );
}

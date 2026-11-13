import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardHeader({ welcomeMessage, subtitle, notificationCount = 0 }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const displayName = user?.full_name?.split(" ")[0] || "there";

  return (
    <header className="bg-primary px-5 pb-8 pt-10 text-white rounded-b-[32px]">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm opacity-80">
            {welcomeMessage || t("home.welcomeDefault")}
          </p>

          <h1 className="mt-1 font-display text-3xl">
            {displayName}
          </h1>

          <p className="mt-2 text-sm opacity-80">
            {subtitle || t("home.subtitleDefault")}
          </p>

        </div>

        <button className="relative rounded-full bg-white/20 p-3" aria-label={t("home.notifications")}>

          <Bell size={22} />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}

        </button>

      </div>

    </header>
  );
}

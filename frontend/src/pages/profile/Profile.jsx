import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Mail,
  Phone,
  Globe,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/api/authApi";
import { extractErrorMessage } from "@/api/client";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

export default function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout, refreshProfile } = useAuth();
  const [updatingLanguage, setUpdatingLanguage] = useState(false);

  const menuItems = [
    { icon: Shield, title: t("profile.privacySecurity"), subtitle: t("profile.privacySecuritySubtitle") },
    { icon: HelpCircle, title: t("profile.helpSupport"), subtitle: t("profile.helpSupportSubtitle") },
  ];

  const initials = (user?.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLanguageChange = async (e) => {
    const lang = e.target.value;
    setUpdatingLanguage(true);

    // Update the whole application's UI language immediately — no reload
    // required, since every component reads from the shared i18n instance.
    i18n.changeLanguage(lang);

    try {
      await authApi.updateLanguage(lang);
      await refreshProfile();
      toast.success(t("profile.languageUpdatedToast"));
    } catch (err) {
      toast.error(extractErrorMessage(err, t("profile.languageUpdateErrorToast")));
    } finally {
      setUpdatingLanguage(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="bg-background">

      {/* Header */}
      <div className="rounded-b-3xl bg-primary px-6 pb-8 pt-12 text-primary-foreground shadow-lg">

        <p className="text-sm opacity-90">{t("profile.welcome")}</p>

        <h1 className="mt-2 text-3xl font-bold">{t("profile.title")}</h1>

        <p className="mt-1 text-sm opacity-90">
          {t("profile.subtitle")}
        </p>

      </div>

      <div className="mx-auto max-w-md space-y-5 px-5 -mt-8">

        {/* Profile Card */}
        <Card className="rounded-2xl p-6 shadow-md">

          <div className="flex items-center gap-4">

            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-2xl text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div>

              <h2 className="text-xl font-semibold">
                {user?.full_name || t("profile.defaultName")}
              </h2>

              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Mail size={16} />
                <span className="text-sm">{user?.email}</span>
              </div>

              {user?.phone_number && (
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Phone size={16} />
                  <span className="text-sm">{user.phone_number}</span>
                </div>
              )}

            </div>

          </div>

        </Card>

        {/* Preferences */}
        <Card className="rounded-2xl p-5">

          <h3 className="mb-4 font-semibold">{t("profile.preferencesHeading")}</h3>

          <div className="space-y-4">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Globe className="text-primary" size={20} />

                <div>
                  <p className="font-medium">{t("profile.preferredLanguage")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.preferredLanguageDescription")}
                  </p>
                </div>

              </div>

              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={user?.preferred_language || "en"}
                onChange={handleLanguageChange}
                disabled={updatingLanguage}
                aria-label={t("profile.preferredLanguage")}
              >
                {SUPPORTED_LANGUAGES.map(({ code }) => (
                  <option key={code} value={code}>{t(`common.languages.${code}`)}</option>
                ))}
              </select>

            </div>

            <Separator />

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Bell className="text-primary" size={20} />

                <div>
                  <p className="font-medium">{t("profile.notifications")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.notificationsDescription")}
                  </p>
                </div>

              </div>

              <Switch defaultChecked />

            </div>

          </div>

        </Card>

        {/* Settings */}
        <Card className="rounded-2xl p-5">

          <h3 className="mb-4 font-semibold">{t("profile.settingsHeading")}</h3>

          <div className="space-y-1">

            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">

                    <Icon size={20} className="text-primary" />

                    <div className="text-left">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>

                  </div>

                  <ChevronRight size={18} />

                </button>
              );
            })}

          </div>

        </Card>

        {/* Logout */}

        <Button
          variant="destructive"
          className="h-12 w-full rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("profile.logout")}
        </Button>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          {t("profile.footerLine1")}
          <br />
          {t("profile.footerLine2")}
        </p>

      </div>


    </div>
  );
}

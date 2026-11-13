import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import QuickUpload from "@/components/dashboard/QuickUpload";
import RecentPrescriptionCard from "@/components/dashboard/RecentPrescriptionCard";
import HealthTipCard from "@/components/dashboard/HealthTipCard";
import { dashboardApi } from "@/api/dashboardApi";
import { extractErrorMessage } from "@/api/client";
import { useMedicineTranslation } from "@/i18n/useMedicineTranslation";

export default function Home() {
  const { t } = useTranslation();
  const translateMedicine = useMedicineTranslation();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await dashboardApi.getOverview();
        if (!cancelled) setOverview(data);
      } catch (err) {
        toast.error(extractErrorMessage(err, t("home.loadErrorToast")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recent = (overview?.recent_reports || []).map((r) => ({
    id: r.id,
    title: translateMedicine(r.title),
    language: r.language,
    date: new Date(r.created_at).toLocaleDateString(),
    status: r.status?.join(", ") || t("common.processed"),
  }));

  return (
    <div className="bg-background">

      <DashboardHeader
        welcomeMessage={overview?.user?.welcome_message}
        subtitle={overview?.user?.subtitle}
        notificationCount={overview?.notifications?.filter((n) => !n.is_read).length}
      />

      <main className="space-y-6 px-4 py-5">

        <QuickUpload />

        {overview?.stats && (
          <section className="grid grid-cols-3 gap-3">
            <StatCard label={t("home.statsReports")} value={overview.stats.total_reports} />
            <StatCard label={t("home.statsVerified")} value={overview.stats.verified_reports} />
            <StatCard label={t("home.statsMedicines")} value={overview.stats.total_medicines_tracked} />
          </section>
        )}

        <section>

          <div className="mb-3 flex items-center justify-between">

            <h2 className="font-display text-2xl text-foreground">
              {t("home.recentPrescriptions")}
            </h2>

            <Link to="/history" className="text-sm font-medium text-primary">
              {t("home.viewAll")}
            </Link>

          </div>

          <div className="space-y-4">

            {!loading && recent.length === 0 && (
              <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
                {t("home.noReports")}
              </p>
            )}

            {recent.map((item) => (
              <RecentPrescriptionCard
                key={item.id}
                prescription={item}
              />
            ))}

          </div>

        </section>

        <HealthTipCard tip={overview?.health_tip} />

      </main>

    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-card">
      <p className="font-display text-2xl text-primary">{value ?? 0}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

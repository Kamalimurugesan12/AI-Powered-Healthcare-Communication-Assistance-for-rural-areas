import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import PrescriptionCard from "@/components/cards/PrescriptionCard";
import { ocrApi } from "@/api/ocrApi";
import { extractErrorMessage } from "@/api/client";
import { useMedicineTranslation } from "@/i18n/useMedicineTranslation";

export default function History() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const translateMedicine = useMedicineTranslation();

  const [rawReports, setRawReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const reports = await ocrApi.list();
        if (!cancelled) setRawReports(reports);
      } catch (err) {
        toast.error(extractErrorMessage(err, t("history.loadErrorToast")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recomputed whenever the raw reports load OR the app's selected
  // language changes, so medicine names stay in sync with the language
  // switcher (translateMedicine depends on i18n.language internally).
  const prescriptions = useMemo(
    () =>
      rawReports.map((r) => ({
        id: r.id,
        date: new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
        medication: translateMedicine(r.primary_medication || r.filename || t("history.medicalReportFallback")),
        doctor: r.doctor_name || t("common.notSpecified"),
        status: r.status || [],
        prescriptionText: r.hospital || "",
        needsReview: r.needs_review,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawReports, translateMedicine, t]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Recent");

  const doctorOptions = useMemo(
    () => ["All", ...new Set(prescriptions.map((p) => p.doctor).filter(Boolean))],
    [prescriptions]
  );

  const filteredPrescriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    let result = prescriptions.filter((item) => {
      const matchesSearch =
        normalizedSearch === "" ||
        item.medication?.toLowerCase().includes(normalizedSearch) ||
        item.doctor?.toLowerCase().includes(normalizedSearch) ||
        item.prescriptionText?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" || item.status?.includes(statusFilter);
      const matchesDoctor =
        doctorFilter === "All" || item.doctor === doctorFilter;

      return matchesSearch && matchesStatus && matchesDoctor;
    });

    result = [...result].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === "Oldest" ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [doctorFilter, prescriptions, search, sortOrder, statusFilter]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(t("history.deleteConfirm"));

    if (!confirmDelete) return;

    try {
      await ocrApi.remove(id);
      setRawReports((prev) => prev.filter((item) => item.id !== id));
      toast.success(t("history.deleteSuccessToast"));
    } catch (err) {
      toast.error(extractErrorMessage(err, t("history.deleteErrorToast")));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setDoctorFilter("All");
    setSortOrder("Recent");
  };

  return (
    <div className="bg-background p-6">
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.description")}
      />

      <div className="mt-6">
        <Input
          placeholder={t("history.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">{t("history.statusAll")}</option>
          <option value="Simplified">{t("history.statusSimplified")}</option>
          <option value="Translated">{t("history.statusTranslated")}</option>
          <option value="Extracted">{t("history.statusExtracted")}</option>
        </select>

        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
        >
          {doctorOptions.map((doc) => (
            <option key={doc} value={doc}>
              {doc === "All" ? t("common.all") : doc}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="Recent">{t("history.sortRecent")}</option>
          <option value="Oldest">{t("history.sortOldest")}</option>
        </select>

        <Button variant="outline" onClick={clearFilters}>
          {t("history.clearFilters")}
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {!loading && filteredPrescriptions.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-8">
            <EmptyState
              title={t("history.emptyTitle")}
              description={t("history.emptyDescription")}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={() => navigate("/upload")}>{t("history.upload")}</Button>
            </div>
          </div>
        ) : (
          filteredPrescriptions.map((prescription) => (
            <PrescriptionCard
              key={prescription.id}
              date={prescription.date}
              medication={prescription.medication}
              language={prescription.needsReview ? t("history.needsReview") : t("history.verified")}
              doctor={prescription.doctor}
              status={prescription.status}
              onView={() => {
                navigate(`/prescription/${prescription.id}`);
              }}
              onDelete={() => {
                handleDelete(prescription.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

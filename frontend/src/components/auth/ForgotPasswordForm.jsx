import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast.success(t("auth.forgotPassword.successToast"));

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div className="relative">
        <Mail
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={20}
        />

        <input
          type="email"
          placeholder={t("auth.forgotPassword.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-xl py-3 pl-11 pr-4"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-xl transition-colors"
      >
        {loading ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.send")}
      </button>

      <p className="text-center text-sm">
        <Link
          to="/login"
          className="text-primary font-semibold"
        >
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </p>

    </form>
  );
}

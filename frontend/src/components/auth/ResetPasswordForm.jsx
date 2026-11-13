import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm() {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("auth.resetPassword.mismatchError"));
      return;
    }

    toast.success(t("auth.resetPassword.successToast"));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <PasswordInput
        id="password"
        name="password"
        placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-xl transition-colors"
      >
        {t("auth.resetPassword.submit")}
      </button>

      <p className="text-center text-sm">
        <Link
          to="/login"
          className="text-primary font-semibold"
        >
          {t("auth.resetPassword.backToLogin")}
        </Link>
      </p>

    </form>
  );
}

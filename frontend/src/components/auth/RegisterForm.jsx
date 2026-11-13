import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import PasswordInput from "./PasswordInput";
import { Button } from "../ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { useAuth } from "@/contexts/AuthContext";
import { extractErrorMessage } from "@/api/client";

export default function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    role: "patient",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getStrength = (password) => {
    if (password.length < 6)
      return { text: t("auth.register.strengthWeak"), width: "33%", color: "bg-destructive" };

    if (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    ) {
      return {
        text: t("auth.register.strengthStrong"),
        width: "100%",
        color: "bg-success",
      };
    }

    return {
      text: t("auth.register.strengthMedium"),
      width: "66%",
      color: "bg-warning",
    };
  };

  const strength = getStrength(formData.password);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await register(formData);

      toast.success(t("auth.register.successToast"));

      navigate("/login");
    } catch (err) {
      console.error(err);
      const message = extractErrorMessage(err, t("auth.register.errorToast"));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <GoogleSignInButton
        label="signup_with"
        onSuccess={() => navigate("/home", { replace: true })}
      />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>

        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2">
            {t("auth.register.orContinueWithEmail")}
          </span>
        </div>
      </div>

      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />

        <input
          type="text"
          name="full_name"
          placeholder={t("auth.register.fullNamePlaceholder")}
          value={formData.full_name}
          onChange={handleChange}
          required
          className="w-full border rounded-xl py-3 pl-11 pr-4"
        />
      </div>

      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />

        <input
          type="email"
          name="email"
          placeholder={t("auth.register.emailPlaceholder")}
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full border rounded-xl py-3 pl-11 pr-4"
        />
      </div>

      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />

        <input
          type="text"
          name="phone_number"
          placeholder={t("auth.register.phonePlaceholder")}
          value={formData.phone_number}
          onChange={handleChange}
          required
          className="w-full border rounded-xl py-3 pl-11 pr-4"
        />
      </div>

      <PasswordInput
        id="password"
        name="password"
        placeholder={t("auth.register.passwordPlaceholder")}
        value={formData.password}
        onChange={handleChange}
        required
      />
      <p className="text-xs text-muted-foreground">
        {t("auth.register.passwordHint")}
      </p>

      <div>
        <div className="h-2 w-full rounded bg-muted">
          <div
            className={`h-2 rounded ${strength.color}`}
            style={{ width: strength.width }}
          />
        </div>

        <p className="mt-1 text-sm">
          {t("auth.register.strengthLabel", { strength: strength.text })}
        </p>
      </div>

      <select
        name="role"
        value={formData.role}
        onChange={handleChange}
        className="w-full border rounded-xl py-3 px-4"
      >
        <option value="patient">{t("auth.register.rolePatient")}</option>
        <option value="healthcare_worker">
          {t("auth.register.roleHealthcareWorker")}
        </option>
      </select>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? t("auth.register.creatingAccount") : t("auth.register.createAccount")}
      </Button>

      <p className="text-center text-sm">
        {t("auth.register.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold">
          {t("auth.register.login")}
        </Link>
      </p>

    </form>
  );
}

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import PasswordInput from "./PasswordInput";
import Loader from "../common/Loader";
import { Button } from "../ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { useAuth } from "@/contexts/AuthContext";
import { extractErrorMessage } from "@/api/client";

export default function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberEmail");

    if (savedEmail) {
      setFormData({
        email: savedEmail,
        password: "",
      });
      setRememberMe(true);
    }
  }, []);

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
      await login(formData.email, formData.password);

      if (rememberMe) {
        localStorage.setItem("rememberEmail", formData.email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      toast.success(t("auth.login.successToast"));

      const redirectTo = location.state?.from?.pathname || "/home";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);

      const message = extractErrorMessage(err, t("auth.login.invalidCredentials"));

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

      <div>
        <label className="mb-2 block font-medium text-foreground">
          {t("auth.login.emailLabel")}
        </label>

        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={20}
          />

          <input
            type="email"
            name="email"
            placeholder={t("auth.login.emailPlaceholder")}
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full rounded-xl border border-input py-3 pl-11 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block font-medium text-foreground">
          {t("auth.login.passwordLabel")}
        </label>

        <PasswordInput
          id="password"
          name="password"
          placeholder={t("auth.login.passwordPlaceholder")}
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          {t("auth.login.rememberMe")}
        </label>

        <Link
          to="/forgot-password"
          className="text-primary hover:underline"
        >
          {t("auth.login.forgotPassword")}
        </Link>
      </div>

      <GoogleSignInButton
        onSuccess={() => {
          const redirectTo = location.state?.from?.pathname || "/home";
          navigate(redirectTo, { replace: true });
        }}
      />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>

        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {t("auth.login.orContinueWithEmail")}
          </span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? <Loader text={t("auth.login.signingIn")} /> : t("auth.login.signIn")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.login.noAccount")}{" "}
        <Link
          to="/register"
          className="font-medium text-primary hover:underline"
        >
          {t("auth.login.register")}
        </Link>
      </p>
    </form>
  );
}

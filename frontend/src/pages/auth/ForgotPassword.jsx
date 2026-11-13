import { useTranslation } from "react-i18next";
import AuthLayout from "../../components/auth/AuthLayout";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";

export default function ForgotPassword() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.forgotPassword.title")}
      subtitle={t("auth.forgotPassword.subtitle")}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

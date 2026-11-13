import { useTranslation } from "react-i18next";
import AuthLayout from "../../components/auth/AuthLayout";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPassword() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.resetPassword.title")}
      subtitle={t("auth.resetPassword.subtitle")}
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}

import { useTranslation } from "react-i18next";
import AuthLayout from "../../components/auth/AuthLayout";
import RegisterForm from "../../components/auth/RegisterForm";

export default function Register() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
    >
      <RegisterForm />
    </AuthLayout>
  );
}

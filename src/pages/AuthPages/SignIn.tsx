import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInFormDesktop from "../../components/auth/SignInFormDesktop";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Iniciar Sesion | Rectificadora App"
        description="Pantalla de inicio de sesion para acceso de escritorio de Rectificadora App."
      />
      <AuthLayout>
        <SignInFormDesktop />
      </AuthLayout>
    </>
  );
}

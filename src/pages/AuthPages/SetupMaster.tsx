import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SetupMasterFormDesktop from "../../components/auth/SetupMasterFormDesktop";

export default function SetupMaster() {
  return (
    <>
      <PageMeta
        title="Configuracion Maestro | Rectificadora App"
        description="Crea el primer usuario maestro para acceso local de escritorio."
      />
      <AuthLayout>
        <SetupMasterFormDesktop />
      </AuthLayout>
    </>
  );
}

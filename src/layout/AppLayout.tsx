import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { BUILD_VERSION, BUILD_BUILT_AT_ISO } from "../generated/build-info";

const resolvedBuildStamp = (() => {
  if (!BUILD_BUILT_AT_ISO) {
    return "sin fecha de compilacion";
  }
  const date = new Date(BUILD_BUILT_AT_ISO);
  if (Number.isNaN(date.getTime())) {
    return BUILD_BUILT_AT_ISO;
  }
  return new Intl.DateTimeFormat("es-VE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
})();

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex min-h-screen flex-col flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <div className="flex-1 p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </div>
        <footer className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Version de compilacion: {BUILD_VERSION} | {resolvedBuildStamp}
        </footer>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;

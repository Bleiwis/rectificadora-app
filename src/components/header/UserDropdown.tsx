import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useAuth } from "../../hooks/useAuth";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const fullName = useMemo(() => {
    if (!user) {
      return "Invitado";
    }

    return user.displayName;
  }, [user]);

  const initials = useMemo(() => {
    if (!user) {
      return "IN";
    }

    const source = user.displayName || user.username;
    const [firstWord = "", secondWord = ""] = source.trim().split(/\s+/, 2);
    const first = firstWord.charAt(0).toUpperCase();
    const second = secondWord.charAt(0).toUpperCase();
    return `${first}${second || first || "M"}`;
  }, [user]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const handleSignOut = () => {
    signOut();
    closeDropdown();
    navigate("/signin");
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-500/15 text-sm font-semibold text-brand-500">
          {initials}
        </span>

        <span className="block mr-1 font-medium text-theme-sm">{fullName}</span>
        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {fullName}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {user ? `@${user.username}` : "Sin sesion"}
          </span>
        </div>

        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Mi cuenta
            </DropdownItem>
          </li>
        </ul>

        {!user ? (
          <Link
            to="/signin"
            onClick={closeDropdown}
            className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
          >
            Iniciar sesion
          </Link>
        ) : (
          <DropdownItem
            tag="button"
            onClick={handleSignOut}
            onItemClick={closeDropdown}
            className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
          >
            Cerrar sesion
          </DropdownItem>
        )}
      </Dropdown>
    </div>
  );
}

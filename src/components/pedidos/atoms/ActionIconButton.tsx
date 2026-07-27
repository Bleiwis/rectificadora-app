import React from "react";

interface ActionIconButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tooltip: string;
  className: string;
  children: React.ReactNode;
}

export default function ActionIconButton({
  onClick,
  tooltip,
  className,
  children,
}: ActionIconButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${className}`}
    >
      {children}
    </button>
  );
}

import type { ReactNode } from "react";

export function Tooltip({
  content,
  children,
  className = "",
}: {
  content: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="group relative inline-flex">
        {children}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {content}
        </span>
      </div>
    </div>
  );
}

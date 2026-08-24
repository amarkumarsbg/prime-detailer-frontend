import type { ReactNode } from "react";

export default function AttendancePublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">{children}</div>
  );
}

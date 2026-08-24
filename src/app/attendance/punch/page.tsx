import { Suspense } from "react";
import { PunchForm } from "./punch-form";

export default function AttendancePunchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <PunchForm />
    </Suspense>
  );
}

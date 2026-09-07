import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

const AppPage = lazy(() => import("../AppPage"));
export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <Suspense fallback={<div className="center-note">renview</div>}>
      <AppPage />
    </Suspense>
  ),
});

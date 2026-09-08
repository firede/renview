import { createFileRoute } from "@tanstack/react-router";
import { handleAppRequest } from "../../server/app";

export const Route = createFileRoute("/healthz")({
  server: { handlers: { GET: ({ request }) => handleAppRequest(request) } },
});

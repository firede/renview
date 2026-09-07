import { createFileRoute } from "@tanstack/react-router";
import { handleAppRequest } from "../../server/app";
export const Route = createFileRoute("/api/$")({
  server: { handlers: { GET: ({ request }) => handleAppRequest(request) } },
});

import { createFileRoute } from "@tanstack/react-router";
import { handleAppRequest } from "../../server/app";
export const Route = createFileRoute("/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAppRequest(request),
      POST: ({ request }) => handleAppRequest(request),
    },
  },
});

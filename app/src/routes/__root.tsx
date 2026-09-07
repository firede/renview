import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import "react-diff-view/style/index.css";
import "../../../web/src/app.css";
import "../style.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "renview" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: () => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});

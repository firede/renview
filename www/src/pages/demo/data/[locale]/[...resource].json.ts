import type { APIRoute } from "astro";
import { demoData } from "../../../../lib/demo-data.gen";

/** 构建时落成静态 JSON；演示不运行分析服务器，也不访问 GitHub。 */
export function getStaticPaths() {
  return Object.entries(demoData).flatMap(([locale, data]) => [
    { params: { locale, resource: "diff" }, props: { data: data.diff } },
    ...Object.entries(data.reviews).map(([path, review]) => ({
      params: { locale, resource: `review/${path}` },
      props: { data: review },
    })),
  ]);
}
export const GET: APIRoute = ({ props }) => Response.json(props.data);

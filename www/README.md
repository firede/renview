# 官网开发

从完整仓库检出运行：

```bash
cd www
bun install --frozen-lockfile
bun run dev
```

`dev`、`build` 会按根目录 lockfile 安装共享查看器依赖；部署构建也需要保留仓库根目录，工作目录可继续使用 `www`。

Demo 通过同源 iframe 加载 `web/src/demo.tsx`，直接使用产品查看器。官网组件只负责外框与嵌入尺寸，不维护另一套图标、样式或交互。

样例修改后在仓库根目录运行 `bun run gen:demo`。生成物沿用产品接口结构，包含变更和完整上下文；官网构建将其输出为静态 JSON，无需分析服务或 GitHub 登录。样例新鲜度由 `test/samples.test.ts` 校验。

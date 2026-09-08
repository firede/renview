/** 有限并发处理列表，结果保持输入顺序。 */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          results[index] = await run(items[index]!, index);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  return results;
}

export function giftWrapFee(items: { wrapped?: boolean }[]): number {
  return items.filter((it) => it.wrapped).length * 3;
}

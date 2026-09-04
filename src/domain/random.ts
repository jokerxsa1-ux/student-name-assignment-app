export type RandomUint32Source = () => number;

const UINT32_RANGE = 0x1_0000_0000;

export function secureRandomUint32(): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('このブラウザでは安全な乱数を利用できません。最新のブラウザで開いてください。');
  }
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0];
}

export function randomIndex(maxExclusive: number, source: RandomUint32Source = secureRandomUint32): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('乱数の範囲は1以上の整数で指定してください。');
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value = source() >>> 0;
  while (value >= limit) value = source() >>> 0;
  return value % maxExclusive;
}

export function shuffled<T>(input: readonly T[], source: RandomUint32Source = secureRandomUint32): T[] {
  const copy = [...input];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, source);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

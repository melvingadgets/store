interface CacheEntry<TValue> {
  expiresAt: number;
  value: TValue;
}

export class SimpleTtlCache<TKey, TValue> {
  private readonly cache = new Map<TKey, CacheEntry<TValue>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: TKey) {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: TKey, value: TValue) {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });

    return value;
  }

  clear() {
    this.cache.clear();
  }
}

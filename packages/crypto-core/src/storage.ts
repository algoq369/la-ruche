import { get, set, del } from 'idb-keyval';

export interface SessionStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export class IdbSessionStore implements SessionStore {
  async get<T>(key: string): Promise<T | undefined> {
    return (await get<T>(key)) ?? undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await set(key, value);
  }
  async del(key: string): Promise<void> {
    await del(key);
  }
}

export class MemorySessionStore implements SessionStore {
  private m = new Map<string, any>();
  async get<T>(key: string): Promise<T | undefined> { return this.m.get(key); }
  async set<T>(key: string, value: T): Promise<void> { this.m.set(key, value); }
  async del(key: string): Promise<void> { this.m.delete(key); }
}

export function createDefaultStore(): SessionStore {
  if (typeof window !== 'undefined' && 'indexedDB' in window) return new IdbSessionStore();
  return new MemorySessionStore();
}


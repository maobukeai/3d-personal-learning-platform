import { BaseAdapter, AdapterConfig } from './base.adapter';
import type { RawCategory, RawResource, RawResourcePage } from './base.adapter';
import { ZyckuAdapter } from './zycku.adapter';

const adapterRegistry: Record<string, new (config: AdapterConfig) => BaseAdapter> = {
  ZYCKU: ZyckuAdapter,
  GENERIC_WP: ZyckuAdapter,
};

export function getAdapter(adapterType: string, config: AdapterConfig): BaseAdapter {
  const AdapterClass = adapterRegistry[adapterType];
  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${adapterType}`);
  }
  return new AdapterClass(config);
}

export function registerAdapter(
  name: string,
  adapterClass: new (config: AdapterConfig) => BaseAdapter,
): void {
  adapterRegistry[name] = adapterClass;
}

export { BaseAdapter, ZyckuAdapter };
export type { RawCategory, RawResource, RawResourcePage, AdapterConfig };

import { EXTERNAL_PROVIDERS, PROVIDER_CATEGORIES } from '@fanste/core';

import { GatewayError } from '../errors';

import type { ProviderAdapter } from './types';
import type { ExternalProvider, ItemCategory } from '@fanste/core';

export interface ProviderRegistry {
  /** The adapter that searches `category`. Throws a `GatewayError` if there is none. */
  forCategory(category: ItemCategory): ProviderAdapter;
  /** The adapter of `provider`. Throws a `GatewayError` if it isn't set up yet. */
  forProvider(provider: ExternalProvider): ProviderAdapter;
}

/** The external provider of each category; categories without one (Funko Pops) are missing. */
export function providerForCategory(category: ItemCategory): ExternalProvider | undefined {
  return EXTERNAL_PROVIDERS.find((provider) =>
    (PROVIDER_CATEGORIES[provider] as readonly ItemCategory[]).includes(category),
  );
}

/** Maps categories and providers to their adapters. */
export function createRegistry(adapters: readonly ProviderAdapter[]): ProviderRegistry {
  const byProvider = new Map(adapters.map((adapter) => [adapter.provider, adapter]));

  function forProvider(provider: ExternalProvider): ProviderAdapter {
    const adapter = byProvider.get(provider);
    if (!adapter) {
      throw new GatewayError('provider_not_configured', `${provider} is not set up yet.`, {
        provider,
      });
    }
    return adapter;
  }

  return {
    forProvider,
    forCategory(category) {
      const provider = providerForCategory(category);
      if (!provider) {
        throw new GatewayError(
          'unsupported_category',
          `"${category}" items have no metadata provider; add them by hand.`,
        );
      }
      return forProvider(provider);
    },
  };
}

import { createContext, type ReactNode, use } from "react";

import type { ApiClient } from "../api/client.js";

const ApiClientContext = createContext<ApiClient | null>(null);

/** Provides the {@link ApiClient}: the fetch client in the app, a fake in tests. */
export function ApiClientProvider({
  client,
  children,
}: {
  readonly client: ApiClient;
  readonly children: ReactNode;
}) {
  return <ApiClientContext value={client}>{children}</ApiClientContext>;
}

/** The {@link ApiClient} of the nearest {@link ApiClientProvider}. */
export function useApiClient(): ApiClient {
  const client = use(ApiClientContext);
  if (client === null) {
    throw new Error("useApiClient must be used inside an ApiClientProvider");
  }
  return client;
}

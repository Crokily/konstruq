import { MockDataProvider } from "./providers/mock";
import type { DataProvider } from "./providers/interface";

export * from "./providers/interface";
export { MockDataProvider } from "./providers/mock";

let provider: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!provider) {
    provider = new MockDataProvider();
  }

  return provider;
}

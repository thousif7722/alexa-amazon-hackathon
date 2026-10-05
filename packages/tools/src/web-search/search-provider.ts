export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  isMock?: boolean;
}

export interface SearchProviderResult {
  query: string;
  results: SearchResultItem[];
  isMock?: boolean;
  provider: string;
  count: number;
}

export interface SearchProvider {
  name: string;
  search(query: string, maxResults?: number): Promise<SearchProviderResult>;
}

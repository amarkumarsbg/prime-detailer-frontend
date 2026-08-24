export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, unknown>;
}

export interface PaginatedState<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  isInitialLoaded: boolean;
  error: string | null;
  fetchPaginated: (params: PaginationParams, append?: boolean) => Promise<void>;
  invalidateAndRefresh: () => Promise<void>;
}

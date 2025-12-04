import { json } from "./response";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Create a standard paginated JSON response.
 */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number,
  total: number
): Response {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const body: PaginatedResult<T> = {
    data: items,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  return json(body, { status: 200 });
}

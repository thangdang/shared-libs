/**
 * Cursor-based Pagination Utility
 *
 * Replaces offset-based pagination (skip/limit) with cursor-based approach
 * for consistent performance regardless of page depth.
 *
 * Usage:
 *   import { paginateCursor } from './cursor-pagination';
 *   const result = await paginateCursor(ProductModel, { status: 'active' }, {
 *     cursor: req.query.cursor,
 *     limit: 20,
 *     sortField: 'createdAt',
 *     sortOrder: 'desc',
 *     select: 'name price thumbnail',
 *   });
 *
 * Copy this file into any service that needs cursor pagination.
 * Only dependency: mongoose (already in all services).
 */

import { Model, FilterQuery, Types } from 'mongoose';

/** Options for cursor-based pagination */
export interface CursorPaginationOptions {
  /** Cursor value — either an ObjectId string or ISO date string */
  cursor?: string | null;
  /** Number of items per page (default: 20, max: 100) */
  limit?: number;
  /** Field to sort by (default: '_id') */
  sortField?: string;
  /** Sort direction (default: 'desc') */
  sortOrder?: 'asc' | 'desc';
  /** Mongoose projection — space-separated fields or object */
  select?: string | Record<string, 0 | 1>;
  /** Whether to include total count (adds extra query, default: false) */
  includeTotal?: boolean;
}

/** Result returned by cursor pagination */
export interface CursorPaginationResult<T> {
  /** Array of documents for the current page */
  items: T[];
  /** Cursor to pass for the next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether there are more items after this page */
  hasMore: boolean;
  /** Total count of matching documents (only if includeTotal: true) */
  total?: number;
}

/** Default number of items per page */
const DEFAULT_LIMIT = 20;
/** Maximum allowed items per page */
const MAX_LIMIT = 100;

/**
 * Determines if a string is a valid MongoDB ObjectId
 */
function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value);
}

/**
 * Determines if a string is a valid ISO date
 */
function isISODate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

/**
 * Builds the cursor filter condition based on sort direction and cursor type
 */
function buildCursorFilter(
  cursor: string,
  sortField: string,
  sortOrder: 'asc' | 'desc'
): Record<string, unknown> {
  const operator = sortOrder === 'desc' ? '$lt' : '$gt';

  // If sorting by _id, use ObjectId comparison
  if (sortField === '_id') {
    if (isObjectId(cursor)) {
      return { _id: { [operator]: new Types.ObjectId(cursor) } };
    }
    throw new Error(`Invalid ObjectId cursor: ${cursor}`);
  }

  // If cursor looks like an ISO date, parse it as Date
  if (isISODate(cursor)) {
    return { [sortField]: { [operator]: new Date(cursor) } };
  }

  // If cursor looks like an ObjectId (for _id-based secondary sort)
  if (isObjectId(cursor)) {
    return { [sortField]: { [operator]: new Types.ObjectId(cursor) } };
  }

  // Fallback: use cursor value as-is (string/number comparison)
  return { [sortField]: { [operator]: cursor } };
}

/**
 * Performs cursor-based pagination on a Mongoose model.
 *
 * @param model - Mongoose model to query
 * @param filter - Base filter query (same as Model.find(filter))
 * @param options - Pagination options (cursor, limit, sortField, etc.)
 * @returns Paginated result with items, nextCursor, and hasMore flag
 *
 * @example
 * // Basic usage with defaults (sort by _id desc, limit 20)
 * const result = await paginateCursor(Product, { status: 'active' });
 *
 * @example
 * // With cursor for next page
 * const page2 = await paginateCursor(Product, { status: 'active' }, {
 *   cursor: result.nextCursor,
 *   limit: 10,
 *   sortField: 'createdAt',
 *   sortOrder: 'desc',
 *   select: 'name price',
 * });
 */
export async function paginateCursor<T>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: CursorPaginationOptions = {}
): Promise<CursorPaginationResult<T>> {
  const {
    cursor = null,
    limit: rawLimit = DEFAULT_LIMIT,
    sortField = '_id',
    sortOrder = 'desc',
    select,
    includeTotal = false,
  } = options;

  // Clamp limit between 1 and MAX_LIMIT
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);

  // Build the combined filter (base filter + cursor condition)
  const combinedFilter: FilterQuery<T> = { ...filter };

  if (cursor) {
    const cursorFilter = buildCursorFilter(cursor, sortField, sortOrder);
    Object.assign(combinedFilter, cursorFilter);
  }

  // Build sort object
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

  // If not sorting by _id, add _id as tiebreaker for stable ordering
  if (sortField !== '_id') {
    sort['_id'] = sortDirection;
  }

  // Execute query — fetch limit + 1 to check if there are more items
  let query = model
    .find(combinedFilter)
    .sort(sort)
    .limit(limit + 1)
    .lean();

  if (select) {
    query = query.select(select as any);
  }

  // Run queries in parallel if total is requested
  const [items, total] = await Promise.all([
    query.exec() as Promise<T[]>,
    includeTotal ? model.countDocuments(filter).exec() : Promise.resolve(undefined),
  ]);

  // Determine if there are more items
  const hasMore = items.length > limit;

  // Remove the extra item used for hasMore check
  if (hasMore) {
    items.pop();
  }

  // Extract next cursor from the last item
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1] as any;
    if (sortField === '_id') {
      nextCursor = String(lastItem._id);
    } else {
      const cursorValue = lastItem[sortField];
      if (cursorValue instanceof Date) {
        nextCursor = cursorValue.toISOString();
      } else if (cursorValue !== undefined && cursorValue !== null) {
        nextCursor = String(cursorValue);
      } else {
        // Fallback to _id if sort field value is missing
        nextCursor = String(lastItem._id);
      }
    }
  }

  const result: CursorPaginationResult<T> = {
    items,
    nextCursor,
    hasMore,
  };

  if (includeTotal && total !== undefined) {
    result.total = total;
  }

  return result;
}

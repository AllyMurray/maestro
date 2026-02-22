/**
 * Converts snake_case DB row keys to camelCase JS object keys.
 * e.g. { project_id: '...' } → { projectId: '...' }
 */
export function mapRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = row[key];
  }
  return result as T;
}

/**
 * Maps an array of snake_case DB rows to camelCase JS objects.
 */
export function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => mapRow<T>(row));
}

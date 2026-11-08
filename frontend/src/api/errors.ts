import type { ApiError } from './types';

export class ApiRequestError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 409) {
    return 'Someone else updated this data. Refreshing the latest version; your draft has been kept. Review the new status before submitting again.';
  }
  if (error instanceof ApiRequestError && error.status === 403) return error.message || 'You do not have permission to perform this action.';
  if (error instanceof ApiRequestError && error.status === 404) return 'Data was not found or is outside your account scope.';
  if (error instanceof Error && error.name === 'TypeError') return 'Cannot connect to the server. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Unable to complete this action. Please try again.';
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiRequestError) || error.status !== 422) return undefined;
  return error.body.field_errors?.find((item) => item.loc.includes(field))?.msg;
}

/**
 * Type-safe error handling utilities for API calls.
 * Replaces the `catch (error)` anti-pattern with proper unknown type handling.
 */

/** Shape of an Axios error response */
interface AxiosLikeError {
  response?: {
    data?: {
      error?: string
      details?: string
      message?: string
    }
    status?: number
    statusText?: string
  }
  message?: string
}

/**
 * Extracts a user-friendly error message from an unknown catch variable.
 * Handles Axios errors, standard Error objects, and plain strings.
 *
 * @param error - The caught error (unknown type)
 * @param fallback - Default message if no meaningful message can be extracted
 * @returns A human-readable error string
 */
export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const err = error as AxiosLikeError
    if (err.response?.data?.error) return err.response.data.error
    if (err.response?.data?.details) return err.response.data.details
    if (err.response?.data?.message) return err.response.data.message
    if (err.message) return err.message
  }

  if (error instanceof Error) return error.message

  return fallback
}

/**
 * Extracts the HTTP status code from an Axios-like error.
 *
 * @param error - The caught error (unknown type)
 * @returns The HTTP status code, or undefined if not available
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const err = error as AxiosLikeError
    return err.response?.status
  }
  return undefined
}

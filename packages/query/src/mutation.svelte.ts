import { invalidate } from './cache'

export interface MutationOptions {
  /** Tags to drop from the cache once the mutation succeeds — the next `createQuery` for those tags refetches. */
  invalidates?: string[]
  /** Runs synchronously before the mutation's promise settles — apply an optimistic UI update here. */
  onMutate?: () => void
  /** Runs if the mutation rejects — undo whatever `onMutate` did. */
  onError?: (error: unknown) => void
}

/** One instance per call site, same shape as `Query`/`Router`. */
export class Mutation<T, A extends unknown[]> {
  #fn: (...args: A) => Promise<T>
  #invalidates: string[]
  #onMutate: MutationOptions['onMutate']
  #onError: MutationOptions['onError']

  #loading = $state(false)
  #error: unknown = $state(null)

  constructor(fn: (...args: A) => Promise<T>, options: MutationOptions = {}) {
    this.#fn = fn
    this.#invalidates = options.invalidates ?? []
    this.#onMutate = options.onMutate
    this.#onError = options.onError
  }

  get loading(): boolean {
    return this.#loading
  }

  get error(): unknown {
    return this.#error
  }

  async mutate(...args: A): Promise<T> {
    this.#loading = true
    this.#error = null
    this.#onMutate?.()

    try {
      const result = await this.#fn(...args)
      for (const tag of this.#invalidates) invalidate(tag)
      return result
    } catch (error) {
      this.#error = error
      this.#onError?.(error)
      throw error
    } finally {
      this.#loading = false
    }
  }
}

export function createMutation<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options?: MutationOptions,
): Mutation<T, A> {
  return new Mutation(fn, options)
}

import type { ApiClient, RequestOptions } from './client'
import type { paths } from './generated/types'

type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

type PathsWithMethod<M extends HttpMethod> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never
}[keyof paths]

type OperationOf<P extends keyof paths, M extends HttpMethod> =
  paths[P] extends Record<M, infer Op> ? Op : never

type PathParamsOf<Op> = Op extends { parameters: { path: infer Params } } ? Params : never
type QueryParamsOf<Op> = Op extends { parameters: { query?: infer Params } } ? Params : never
type HasPathParams<Op> = [PathParamsOf<Op>] extends [never] ? false : true

/** `undefined` (not `never`) when the operation has no JSON body — e.g. a 204 — so `Promise<undefined>` is inferable. */
type JsonContentOf<T> = T extends { content: { 'application/json': infer J } } ? J : undefined
type SuccessStatus = 200 | 201 | 202 | 203 | 204

type SuccessResponseOf<Op> = Op extends { responses: infer R }
  ? JsonContentOf<R[Extract<keyof R, SuccessStatus>]>
  : never

type RequestBodyOf<Op> = Op extends { requestBody: { content: { 'application/json': infer B } } }
  ? B
  : Op extends { requestBody?: { content: { 'application/json': infer B } } }
    ? B | undefined
    : undefined

type ParamsOption<Op> =
  HasPathParams<Op> extends true
    ? { params: { path: PathParamsOf<Op>; query?: QueryParamsOf<Op> } }
    : { params?: { query?: QueryParamsOf<Op> } }

type TypedRequestOptions<Op> = Omit<RequestOptions, 'method' | 'body' | 'query'> & ParamsOption<Op>

/**
 * Typed wrapper over {@link ApiClient} — path/method are checked against the
 * generated `paths` map, request bodies and success responses are typed from
 * the matching `operations[...]` entry. The runtime (headers, retries,
 * timeouts, problem+json → {@link ApiError}) stays entirely in `client.ts`;
 * this layer only does compile-time shape-checking and `{param}` substitution.
 */
export interface TypedApiClient {
  GET<P extends PathsWithMethod<'get'>>(
    path: P,
    ...options: HasPathParams<OperationOf<P, 'get'>> extends true
      ? [TypedRequestOptions<OperationOf<P, 'get'>>]
      : [TypedRequestOptions<OperationOf<P, 'get'>>?]
  ): Promise<SuccessResponseOf<OperationOf<P, 'get'>>>

  POST<P extends PathsWithMethod<'post'>>(
    path: P,
    body: RequestBodyOf<OperationOf<P, 'post'>>,
    ...options: HasPathParams<OperationOf<P, 'post'>> extends true
      ? [TypedRequestOptions<OperationOf<P, 'post'>>]
      : [TypedRequestOptions<OperationOf<P, 'post'>>?]
  ): Promise<SuccessResponseOf<OperationOf<P, 'post'>>>

  PUT<P extends PathsWithMethod<'put'>>(
    path: P,
    body: RequestBodyOf<OperationOf<P, 'put'>>,
    ...options: HasPathParams<OperationOf<P, 'put'>> extends true
      ? [TypedRequestOptions<OperationOf<P, 'put'>>]
      : [TypedRequestOptions<OperationOf<P, 'put'>>?]
  ): Promise<SuccessResponseOf<OperationOf<P, 'put'>>>

  PATCH<P extends PathsWithMethod<'patch'>>(
    path: P,
    body: RequestBodyOf<OperationOf<P, 'patch'>>,
    ...options: HasPathParams<OperationOf<P, 'patch'>> extends true
      ? [TypedRequestOptions<OperationOf<P, 'patch'>>]
      : [TypedRequestOptions<OperationOf<P, 'patch'>>?]
  ): Promise<SuccessResponseOf<OperationOf<P, 'patch'>>>

  DELETE<P extends PathsWithMethod<'delete'>>(
    path: P,
    ...options: HasPathParams<OperationOf<P, 'delete'>> extends true
      ? [TypedRequestOptions<OperationOf<P, 'delete'>>]
      : [TypedRequestOptions<OperationOf<P, 'delete'>>?]
  ): Promise<SuccessResponseOf<OperationOf<P, 'delete'>>>
}

/** Replaces every `{name}` segment of an OpenAPI path template with its value. Throws on a missing value rather than sending a literal `{name}` to the server. */
export function substitutePathParams(
  path: string,
  params: Record<string, unknown> | undefined,
): string {
  return path.replace(/\{([^}]+)\}/g, (_segment, name: string) => {
    const value = params?.[name]
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for "${path}"`)
    }
    return encodeURIComponent(String(value))
  })
}

type UntypedCallOptions = Omit<RequestOptions, 'method' | 'body' | 'query'> & {
  params?: { path?: Record<string, unknown>; query?: RequestOptions['query'] }
}

export function createTypedApiClient(client: ApiClient): TypedApiClient {
  function call<T>(
    method: RequestOptions['method'],
    path: string,
    body: unknown,
    options: UntypedCallOptions | undefined,
  ): Promise<T> {
    const resolvedPath = substitutePathParams(path, options?.params?.path)
    const { params, ...rest } = options ?? {}
    return client.request<T>(resolvedPath, { ...rest, method, body, query: params?.query })
  }

  return {
    GET: (path: string, options?: UntypedCallOptions) => call('GET', path, undefined, options),
    POST: (path: string, body: unknown, options?: UntypedCallOptions) =>
      call('POST', path, body, options),
    PUT: (path: string, body: unknown, options?: UntypedCallOptions) =>
      call('PUT', path, body, options),
    PATCH: (path: string, body: unknown, options?: UntypedCallOptions) =>
      call('PATCH', path, body, options),
    // The object literal's plain `(string, ...)` signatures don't structurally match
    // `TypedApiClient`'s per-path generic overloads — that's the point of this file:
    // callers get the checked, narrow interface; this implementation is the one place
    // that's deliberately untyped so it can dispatch on a runtime string path.
    DELETE: (path: string, options?: UntypedCallOptions) =>
      call('DELETE', path, undefined, options),
  } as unknown as TypedApiClient
}

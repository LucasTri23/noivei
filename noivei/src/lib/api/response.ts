// Helpers de resposta padrão da API — nunca expor stack trace ao cliente.

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200): Response {
  return Response.json(meta ? { data, meta } : { data }, { status })
}

export function err(status: number, code: string, message: string, details?: unknown): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        requestId: crypto.randomUUID(),
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  )
}

// Erro tipado lançado pelos guards (requireAuth, requireWeddingOwnership) e
// convertido em resposta HTTP pelo handleApiError no catch de cada handler.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return err(error.status, error.code, error.message, error.details)
  }

  console.error('[api] erro inesperado:', error)
  return err(500, 'INTERNAL_ERROR', 'Erro interno inesperado.')
}

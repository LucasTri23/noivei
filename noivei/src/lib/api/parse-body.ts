import { ApiError } from '@/lib/api/response'

// Lê o body JSON da requisição; JSON malformado vira 400 (não 500).
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Corpo da requisição não é um JSON válido.')
  }
}

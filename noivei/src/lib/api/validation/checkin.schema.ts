import { z } from 'zod'

// Corpo escaneado da câmera (texto cru do QR code) — o mesmo valor gravado em
// guests.rsvp_token, ver src/app/ingresso/[token]/page.tsx.
export const ValidateCheckinSchema = z.object({
  token: z.string().trim().min(1),
})

export type ValidateCheckinInput = z.infer<typeof ValidateCheckinSchema>

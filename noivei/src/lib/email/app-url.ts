// URL base do app usada para montar links dentro dos e-mails (RSVP, digest...).
// Sem NEXT_PUBLIC_APP_URL configurada (ex: dev local), assume localhost.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

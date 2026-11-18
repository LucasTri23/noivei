// Tetos da seção Nossa História — os de quantidade são repetidos nos triggers
// da migration 20261118000002 (o banco é a barreira final).
export const STORY_LIMITS = {
  moments:           20,
  photos:            24,
  titleLength:       120,
  descriptionLength: 2000,
  captionLength:     200,
  storyTextLength:   4000,
  // Mesmo file_size_limit do bucket "wedding-photos".
  maxFileBytes:      8 * 1024 * 1024,
  // Maior lado da imagem depois da otimização feita no navegador.
  maxDimension:      2400,
} as const

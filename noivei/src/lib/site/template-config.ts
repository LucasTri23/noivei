import type { SiteTemplate } from '@/types/database'
export type StyleField = 'hero_subtitle' | 'story_heading' | 'gallery_heading' | 'envelope_caption' | 'opening_hint'
export interface StyleFieldConfig { key: StyleField; label: string; placeholder: string; maxLength: number }
interface TemplateConfig {
  label: string; galleryLimit: number | null; storyPhoto: boolean; storyLabel: string; photoGuide: string; fields: StyleFieldConfig[]
}
const subtitle: StyleFieldConfig = { key: 'hero_subtitle', label: 'Frase de abertura', placeholder: 'Para a vida inteira. E para celebrar com quem amamos.', maxLength: 240 }
const storyHeading: StyleFieldConfig = { key: 'story_heading', label: 'Título da história', placeholder: 'De todos os encontros, o nosso.', maxLength: 120 }
const galleryHeading: StyleFieldConfig = { key: 'gallery_heading', label: 'Título da galeria', placeholder: 'O amor mora nos detalhes.', maxLength: 120 }
export const SITE_TEMPLATE_CONFIG: Record<SiteTemplate, TemplateConfig> = {
  classic: { label: 'Clássico', galleryLimit: null, storyPhoto: false, storyLabel: 'Nossa história', photoGuide: '1 capa. As 8 primeiras fotos da galeria compõem a história em polaroids; as demais aparecem na galeria. Sem teto por estilo, respeitando o armazenamento do plano.', fields: [] },
  portfolio: { label: 'Portfólio', galleryLimit: 14, storyPhoto: true, storyLabel: 'Sobre os noivos', photoGuide: '1 capa em tela cheia, 1 foto de destaque da história e até 14 fotos na grade assimétrica (4 + 5 + 5).', fields: [] },
  editorial: { label: 'Editorial', galleryLimit: 8, storyPhoto: true, storyLabel: 'A história do casal', photoGuide: '1 capa editorial, 1 retrato para a história e até 8 fotos na galeria de memórias.', fields: [subtitle, storyHeading, galleryHeading] },
  garden: { label: 'Jardim Romântico', galleryLimit: 12, storyPhoto: true, storyLabel: 'Como o nosso amor floresceu', photoGuide: '1 capa com moldura botânica, 1 foto da história e até 12 fotos na galeria do jardim.', fields: [{ ...subtitle, label: 'Mensagem de boas-vindas ao jardim' }, { ...storyHeading, label: 'Título da história de vocês' }, { ...galleryHeading, label: 'Título das memórias do jardim' }] },
  invitation: { label: 'Convite Selado', galleryLimit: 6, storyPhoto: true, storyLabel: 'Mensagem aos convidados', photoGuide: 'Envelope na cor do casamento com selo dourado, 1 foto de capa, 1 foto para a mensagem e até 6 fotos na galeria do convite.', fields: [{ ...subtitle, label: 'Texto do convite', placeholder: 'Temos a alegria de convidar você para celebrar o nosso casamento.' }, { key: 'envelope_caption', label: 'Dedicatória no envelope', placeholder: 'Com carinho, para você', maxLength: 80 }, { key: 'opening_hint', label: 'Instrução para abrir o convite', placeholder: 'Toque no selo dourado para abrir', maxLength: 100 }] },
}
export function limitTemplateGallery<T>(photos: T[], template: SiteTemplate): T[] {
  const limit = SITE_TEMPLATE_CONFIG[template].galleryLimit
  return limit === null ? photos : photos.slice(0, limit)
}

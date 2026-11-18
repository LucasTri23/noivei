import type { SiteTemplate, StoryDatePrecision } from '@/types/database'

import { resolveStoryLayout, type StoryLayout } from './story-layouts'

// Regras de dados da seção Nossa História — compartilhadas por todos os estilos.
// Os componentes visuais recebem um StoryView pronto e só decidem a aparência.

export interface StoryMomentInput {
  id:             string
  title:          string | null
  description:    string | null
  happened_on:    string | null
  date_precision: StoryDatePrecision
  sort_order:     number
}

export interface StoryPhotoInput {
  id:          string
  url:         string
  caption:     string | null
  moment_id:   string | null
  sort_order:  number
  width:       number | null
  height:      number | null
  position_y:  number
  fit_contain: boolean
}

export interface StoryData {
  moments: StoryMomentInput[]
  photos:  StoryPhotoInput[]
}

export interface StoryPhotoView extends StoryPhotoInput {
  /** Legenda própria ou, sem ela, o título do momento da foto. */
  displayCaption: string | null
}

export interface StoryMomentView extends StoryMomentInput {
  dateLabel: string | null
  photos:    StoryPhotoView[]
}

export type StoryBlock =
  | { type: 'text';   text: string }
  | { type: 'photos'; photos: StoryPhotoView[]; /** posição da 1ª foto do bloco entre as fotos soltas */ offset: number }

export type StoryView =
  | { layout: 'legacy' }
  | {
      layout:      StoryLayout
      /** Texto principal (our_story) — vazio quando não preenchido. */
      text:        string
      /** Texto em parágrafos intercalado com as fotos sem momento (modo ilustrado). */
      blocks:      StoryBlock[]
      /** Momentos na ordem de exibição — cronológica na linha do tempo. */
      moments:     StoryMomentView[]
      /** Fotos sem momento, na ordem definida pelo casal. */
      loosePhotos: StoryPhotoView[]
      /** Todas as fotos na ordem definida pelo casal (galeria narrativa). */
      allPhotos:   StoryPhotoView[]
      hasContent:  boolean
    }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "12 de junho de 2019" / "junho de 2019" / "2019" — sem fuso (data pura YYYY-MM-DD). */
export function formatStoryDate(date: string | null, precision: StoryDatePrecision): string | null {
  if (!date) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const [, year, month, day] = match
  const monthName = MONTHS[Number(month) - 1]
  if (!monthName) return null
  if (precision === 'year') return year ?? null
  if (precision === 'month') return `${monthName} de ${year}`
  return `${Number(day)} de ${monthName} de ${year}`
}

/** Parágrafos separados por linha em branco; quebras simples ficam dentro do parágrafo. */
export function splitStoryParagraphs(text: string): string[] {
  return text.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean)
}

/**
 * Distribui grupos de fotos de forma uniforme entre os parágrafos: cada grupo
 * entra depois de um parágrafo, começando pelo primeiro. Sem texto, as fotos
 * viram um único bloco.
 */
export function interleaveStory(paragraphs: string[], photos: StoryPhotoView[], groupSize = 2): StoryBlock[] {
  const groups: StoryPhotoView[][] = []
  for (let i = 0; i < photos.length; i += groupSize) groups.push(photos.slice(i, i + groupSize))

  if (paragraphs.length === 0) return groups.length ? [{ type: 'photos', photos, offset: 0 }] : []

  const blocks: StoryBlock[] = []
  paragraphs.forEach((text, index) => {
    blocks.push({ type: 'text', text })
    groups.forEach((group, groupIndex) => {
      if (Math.floor((groupIndex * paragraphs.length) / groups.length) === index) {
        blocks.push({ type: 'photos', photos: group, offset: groupIndex * groupSize })
      }
    })
  })
  return blocks
}

function bySortOrder<T extends { sort_order: number }>(a: T, b: T): number {
  return a.sort_order - b.sort_order
}

/** Datados em ordem cronológica; sem data mantêm a ordem do casal e vêm depois. */
export function sortMomentsChronologically<T extends StoryMomentInput>(moments: T[]): T[] {
  const dated   = moments.filter((m) => m.happened_on).sort((a, b) => (a.happened_on as string).localeCompare(b.happened_on as string) || bySortOrder(a, b))
  const undated = moments.filter((m) => !m.happened_on).sort(bySortOrder)
  return [...dated, ...undated]
}

export function buildStoryView(
  template:     SiteTemplate,
  storedLayout: unknown,
  text:         string | undefined,
  data:         StoryData,
): StoryView {
  const layout = resolveStoryLayout(template, storedLayout)
  if (layout === 'legacy') return { layout }

  const momentsById = new Map(data.moments.map((m) => [m.id, m]))
  const allPhotos: StoryPhotoView[] = [...data.photos].sort(bySortOrder).map((photo) => {
    // Foto apontando para momento inexistente (não deveria ocorrer pela FK) é tratada como solta.
    const moment = photo.moment_id ? momentsById.get(photo.moment_id) : undefined
    return {
      ...photo,
      moment_id:      moment ? photo.moment_id : null,
      displayCaption: photo.caption?.trim() || moment?.title?.trim() || null,
    }
  })

  const orderedMoments = layout === 'timeline' ? sortMomentsChronologically(data.moments) : [...data.moments].sort(bySortOrder)
  const moments: StoryMomentView[] = orderedMoments.map((moment) => ({
    ...moment,
    dateLabel: formatStoryDate(moment.happened_on, moment.date_precision),
    photos:    allPhotos.filter((photo) => photo.moment_id === moment.id),
  }))

  const loosePhotos = allPhotos.filter((photo) => !photo.moment_id)
  const storyText = (text ?? '').trim()

  return {
    layout,
    text:        storyText,
    blocks:      interleaveStory(splitStoryParagraphs(storyText), loosePhotos),
    moments,
    loosePhotos,
    allPhotos,
    hasContent:  Boolean(storyText) || moments.length > 0 || allPhotos.length > 0,
  }
}

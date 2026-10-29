import { document as cloud } from './readings/gott-ist-eine-wolke'
import { document as philosophy } from './readings/philosophie-der-omnizedenz'
import { document as soul } from './readings/die-verkoerperte-seele'
import { document as identity } from './readings/die-physik-des-ich'

/** Free-to-read manuscript editions; no payment or credit checks. */
export const READING_TEXTS: Readonly<Record<string, { title: string; version: string; source: string; sections: readonly { heading: string; text: string }[] }>> = {
  [cloud.bookId]: cloud,
  [philosophy.bookId]: philosophy,
  [soul.bookId]: soul,
  [identity.bookId]: identity,
}

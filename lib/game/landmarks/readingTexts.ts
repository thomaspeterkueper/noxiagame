import { document as cloud } from './readings/gott-ist-eine-wolke'
import { document as philosophy } from './readings/philosophie-der-omnizedenz'
import { document as soul } from './readings/die-verkoerperte-seele'
import { document as identity } from './readings/die-physik-des-ich'
import { document as children } from './readings/kinder-gottes'
import { document as agur } from './readings/agurs-worte'
import { document as enlightened } from './readings/der-erhellte-blick'

/** Free-to-read manuscript editions; no payment or credit checks. */
export const READING_TEXTS: Readonly<Record<string, { title: string; version: string; source: string; sections: readonly { heading: string; text: string }[] }>> = {
  [cloud.bookId]: cloud,
  [philosophy.bookId]: philosophy,
  [soul.bookId]: soul,
  [identity.bookId]: identity,
  [children.bookId]: children,
  [agur.bookId]: agur,
  [enlightened.bookId]: enlightened,
}

import type { Plural } from "./format";
import type { Messages } from "./messages/en";

/**
 * What a language file provides: any part of the English messages. Whatever it
 * leaves out falls back to English, and `npm run i18n:check` lists the gaps.
 * Plural forms and lists are replaced whole, never mixed with English.
 */
export type Translation = DeepPartial<Messages>;

type DeepPartial<T> = T extends Plural
  ? [keyof T] extends [keyof Plural]
    ? Plural
    : { [K in keyof T]?: DeepPartial<T[K]> }
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/**
 * Compile-time key parity for the message catalogs.
 *
 * Each pair below fails `types:check` (pre-commit, CI, IDE) when a locale
 * misses a key that en.json has, or carries a key that en.json does not.
 * JSON imports type every value as `string`, so only the key structure is
 * compared — ICU placeholder parity is `src/i18n/__tests__/catalog.test.ts`.
 *
 * Type-only module: erased at build time, nothing ships to the bundle.
 */
import type en from "@/i18n/messages/en.json";
import type zh from "@/i18n/messages/zh.json";

/** Compiles only when `Catalog` has every key of `Shape`, same nesting. */
type Covers<Catalog extends Shape, Shape> = Catalog;

/** [no missing keys vs en.json, no extra keys vs en.json] */
export type SimplifiedChineseParity = [
  Covers<typeof zh, typeof en>,
  Covers<typeof en, typeof zh>,
];

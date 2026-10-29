/**
 * Names in Persian alphabetical order — «پ» right after «ب», not after «ت»
 * as its code point would put it. Every maintenance list sorted "by name"
 * uses this one comparison.
 */
export function byPersianName(left: string, right: string): number {
  return left.localeCompare(right, 'fa');
}

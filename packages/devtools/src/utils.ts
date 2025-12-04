export function cn(
  ...classes: Array<string | number | null | undefined | false>
): string {
  return classes.filter(Boolean).join(' ');
}
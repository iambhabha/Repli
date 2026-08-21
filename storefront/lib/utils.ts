import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names, letting the later one win.
 *
 * clsx flattens conditionals; tailwind-merge then resolves collisions, so a
 * component's own `px-3` loses to a `px-6` passed in from outside instead of
 * both landing in the attribute and the cascade picking by stylesheet order.
 *
 * Every shadcn component expects to import this from exactly here.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

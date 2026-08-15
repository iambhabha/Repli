import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The shadcn/ui `cn` helper, at the path shadcn components expect
 * (`@/lib/utils`). clsx builds the class string, tailwind-merge resolves
 * conflicts so a later `px-6` really does beat an earlier `px-3`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

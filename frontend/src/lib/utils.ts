import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Para juntar clases Tailwind sin choques
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

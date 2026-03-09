import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatINR = (amount: number) =>
  amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

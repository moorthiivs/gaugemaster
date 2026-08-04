import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRoleName(role: any): string {
  if (!role) return "";
  if (typeof role === "string") return role;
  if (typeof role === "object" && role.name) return String(role.name);
  return "";
}


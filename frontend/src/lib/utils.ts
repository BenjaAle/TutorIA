import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/*class names: limpieza de coincidencia de estilos para casos condicionales*/
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

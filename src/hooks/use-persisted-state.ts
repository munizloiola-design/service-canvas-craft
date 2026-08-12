import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState que lembra o último valor no localStorage (por usuário e navegador).
 * A leitura acontece apenas após a hidratação para evitar mismatch de SSR.
 */
export function usePersistedState<T>(
  key: string | null,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* valor inválido: ignora */
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (key && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            /* storage cheio/bloqueado: ignora */
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}

export function persistKey(screen: string, field: string, userId?: string | null) {
  return `dw:${screen}:${field}:${userId ?? "anon"}`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseLocalListOpts<T> = {
  load: () => T[];
  save: (items: T[]) => void;
  event?: string;
};

export function useLocalList<T>(opts: UseLocalListOpts<T>) {
  const [items, setItems] = useState<T[]>([]);
  const loadedRef = useRef<boolean>(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  // Dedupe save→event→load→save feedback: skip no-op reloads and no-op saves.
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const initial = optsRef.current.load();
    lastKeyRef.current = JSON.stringify(initial);
    setItems(initial);
    loadedRef.current = true;
    if (typeof window === "undefined" || !optsRef.current.event) return;
    const reload = () => {
      const next = optsRef.current.load();
      const key = JSON.stringify(next);
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      setItems(next);
    };
    window.addEventListener(optsRef.current.event, reload);
    return () => {
      if (optsRef.current.event) window.removeEventListener(optsRef.current.event, reload);
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const key = JSON.stringify(items);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    optsRef.current.save(items);
  }, [items]);

  const add = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const removeWhere = useCallback((predicate: (item: T) => boolean) => {
    setItems((prev) => prev.filter((i) => !predicate(i)));
  }, []);

  const update = useCallback((mapper: (item: T) => T) => {
    setItems((prev) => prev.map(mapper));
  }, []);

  return { items, setItems, add, removeWhere, update };
}

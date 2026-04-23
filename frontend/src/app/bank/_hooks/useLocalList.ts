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

  useEffect(() => {
    setItems(optsRef.current.load());
    loadedRef.current = true;
    if (typeof window === "undefined" || !optsRef.current.event) return;
    const reload = () => setItems(optsRef.current.load());
    window.addEventListener(optsRef.current.event, reload);
    return () => {
      if (optsRef.current.event) window.removeEventListener(optsRef.current.event, reload);
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
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

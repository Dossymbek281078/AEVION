"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadCircles,
  saveCircles,
  type Circle,
  type CircleMember,
  type CircleMessage,
  type CircleMessageKind,
} from "../_lib/circles";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useCircles() {
  const [items, setItems] = useState<Circle[]>([]);

  useEffect(() => {
    setItems(loadCircles());
  }, []);

  useEffect(() => {
    saveCircles(items);
  }, [items]);

  const add = useCallback((name: string, members: CircleMember[]): Circle => {
    const c: Circle = {
      id: newId("circle"),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      members,
      messages: [],
    };
    setItems((prev) => [c, ...prev]);
    return c;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const postMessage = useCallback(
    (
      circleId: string,
      input: {
        authorId: string;
        authorNickname: string;
        kind: CircleMessageKind;
        text: string;
        amount?: number;
        recipient?: string;
        memo?: string;
      },
    ) => {
      const msg: CircleMessage = {
        id: newId("msg"),
        authorId: input.authorId,
        authorNickname: input.authorNickname,
        createdAt: new Date().toISOString(),
        kind: input.kind,
        text: input.text,
        amount: input.amount,
        recipient: input.recipient,
        memo: input.memo,
      };
      setItems((prev) =>
        prev.map((c) =>
          c.id === circleId ? { ...c, messages: [...c.messages, msg] } : c,
        ),
      );
    },
    [],
  );

  return { items, add, remove, postMessage };
}

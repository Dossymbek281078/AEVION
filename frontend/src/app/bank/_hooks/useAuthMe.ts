"use client";

import { useEffect, useState } from "react";
import { fetchMe } from "../_lib/api";
import type { Me } from "../_lib/types";

const TOKEN_KEY = "aevion_auth_token_v1";

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function useAuthMe() {
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = readToken();
      if (!cancelled) setToken(t);
      if (!t) {
        if (!cancelled) setChecked(true);
        return;
      }
      const user = await fetchMe();
      if (!cancelled) {
        setMe(user);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { token, me, checked };
}

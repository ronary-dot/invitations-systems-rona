"use client";

import { useEffect } from "react";
import { markInviteOpened } from "./actions";

// Runs only in a real browser, so link-preview bots don't mark the invite as opened.
export function MarkOpened({ token }: { token: string }) {
  useEffect(() => {
    void markInviteOpened(token);
  }, [token]);
  return null;
}

"use client";
// Popups (dialogs, lightboxes) are drawn straight into <body>. Inside a sticky card, a
// blurred header or anything else with its own layer, a fixed-position popup is placed
// and stacked within that layer, so the page's later parts (the footer's app badges, say)
// end up on top of it.

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export default function OnTop({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

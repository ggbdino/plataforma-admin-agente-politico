"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  label?: string;
  value: string;
};

export function CopyLinkButton({ label = "Copiar link", value }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="button secondary copy-link-button" onClick={handleCopy} type="button">
      <span aria-hidden="true">{copied ? "✓" : "⎘"}</span>
      <span>{copied ? "Link copiado" : label}</span>
    </button>
  );
}

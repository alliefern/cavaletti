export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error) return <div className="flash flash-error">✖ {sp.error}</div>;
  if (sp.ok) return <div className="flash flash-ok">✔ {sp.ok}</div>;
  return null;
}

export type SP = Promise<Record<string, string | undefined>>;

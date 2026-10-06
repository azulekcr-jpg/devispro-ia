import type { ReactNode } from 'react';

export default function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="f">
      <span>{label}</span>
      {children}
      {error && <p className="fe" role="alert">{error}</p>}
    </label>
  );
}

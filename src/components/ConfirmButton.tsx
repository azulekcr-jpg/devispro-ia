'use client';
import { useEffect, useState } from 'react';

// Suppression en deux appuis : « Supprimer » puis « Confirmer ? ».
export default function ConfirmButton({ label, onConfirm, className = 'btn s dng', disabled = false }: { label: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? 'Confirmer ?' : label}
    </button>
  );
}

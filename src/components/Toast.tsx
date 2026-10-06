'use client';
import { useCallback, useRef, useState } from 'react';

// Message court en bas de l'écran (confirmations, erreurs).
export function useToast() {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setText(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(''), 4500);
  }, []);
  const toastNode = text ? <div id="toast" role="status">{text}</div> : null;
  return { toast, toastNode };
}

import type { ReactNode } from 'react';

type Props = { eyebrow?: string; title: string; children?: ReactNode };

export default function Hero({ eyebrow, title, children }: Props) {
  return (
    <header className="hero">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function formatEventDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

import { useId } from 'react';
import { TIERS, gamesNearLevel, tierOf } from '../lib/levels';
import type { Game } from '../lib/api';

type Props = {
  value: number;
  onChange: (level: number) => void;
  games: Game[];
};

/** Curseur de niveau 1–10 avec les trois catégories et des jeux du catalogue en exemple. */
export default function LevelPicker({ value, onChange, games }: Props) {
  const id = useId();
  const tier = tierOf(value);
  const examples = gamesNearLevel(games, value).slice(0, 3).map((g) => g.name);

  return (
    <div className="field">
      <div className="level-head">
        <label htmlFor={id}>Les jeux qui te motivent</label>
        <output htmlFor={id} className="level-value" aria-live="polite">
          {value}
          <span>/10</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} sur 10, ${tier.label}`}
        className="level-range"
      />
      <div className="tiers" aria-hidden="true">
        {TIERS.map((t) => (
          <button
            key={t.key}
            type="button"
            tabIndex={-1}
            className={`tier ${t.key === tier.key ? 'tier-on' : ''}`}
            onClick={() => onChange(Math.round((t.min + t.max) / 2))}
          >
            {t.label}
            <br />
            {t.min} – {t.max}
          </button>
        ))}
      </div>
      <p className="card level-desc">
        {tier.description}
        {examples.length > 0 && (
          <>
            {' '}
            <span className="muted">Au programme : {examples.join(', ')}.</span>
          </>
        )}
      </p>
    </div>
  );
}

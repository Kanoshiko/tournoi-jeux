import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Hero from '../../components/Hero';
import { fetchCurrentTournament, findPlayer } from '../../lib/api';
import { rememberToken } from '../../lib/playerStore';

export default function Retrouver() {
  const navigate = useNavigate();
  const [pseudo, setPseudo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!pseudo.trim() || !/^\d{4}$/.test(code.trim())) {
      setError('Indique ton pseudo et ton code à 4 chiffres.');
      return;
    }
    setBusy(true);
    try {
      const t = await fetchCurrentTournament();
      const token = t ? await findPlayer(t.id, pseudo, code) : null;
      if (!token) {
        setError('Aucune inscription ne correspond à ce pseudo et ce code.');
        setBusy(false);
        return;
      }
      rememberToken(token);
      navigate(`/moi/${token}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <Hero title="Retrouver mon inscription" />
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="pseudo">Ton pseudo</label>
          <input id="pseudo" className="input" autoComplete="nickname" maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="code">Ton code à 4 chiffres</label>
          <input
            id="code"
            className="input input-code"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Recherche…' : 'Retrouver'}</button>
        <p className="muted small center">Code perdu ? Demande à un organisateur. · <Link to="/">S’inscrire</Link></p>
      </form>
    </main>
  );
}

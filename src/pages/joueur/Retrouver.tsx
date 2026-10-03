import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Hero from '../../components/Hero';
import { fetchCurrentTournament, findPlayer } from '../../lib/api';
import { rememberToken } from '../../lib/playerStore';

export default function Retrouver() {
  const navigate = useNavigate();
  const [pseudo, setPseudo] = useState('');
  const [animal, setAnimal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!pseudo.trim() || !animal.trim()) {
      setError('Indique ton pseudo et ton animal secret.');
      return;
    }
    setBusy(true);
    try {
      const t = await fetchCurrentTournament();
      const token = t ? await findPlayer(t.id, pseudo, animal) : null;
      if (!token) {
        setError('Aucune inscription ne correspond à ce pseudo et cet animal.');
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
          <label htmlFor="animal">Ton animal secret</label>
          <input
            id="animal"
            className="input"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex. loutre"
            maxLength={30}
            value={animal}
            onChange={(e) => setAnimal(e.target.value)}
          />
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Recherche…' : 'Retrouver'}</button>
        <p className="muted small center">Animal oublié ? Demande à un organisateur. · <Link to="/">S’inscrire</Link></p>
      </form>
    </main>
  );
}

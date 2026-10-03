import { useState, type FormEvent } from 'react';
import { sendMagicLink } from '../../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Indique une adresse e-mail valide.');
      return;
    }
    setBusy(true);
    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <div className="card stack">
        <div>
          <p className="eyebrow muted">Tournoi par équipes</p>
          <h1 className="h-admin">Espace organisateurs</h1>
        </div>
        {sent ? (
          <div className="stack-sm">
            <p><strong>Un lien de connexion vient d’être envoyé à {email.trim()}.</strong></p>
            <p className="muted small">Ouvre-le sur cet ordinateur. Pense à regarder dans les spams. Le lien n’est valable qu’une fois.</p>
            <button type="button" className="btn-text" onClick={() => setSent(false)}>Utiliser une autre adresse</button>
          </div>
        ) : (
          <form className="stack-sm" onSubmit={submit} noValidate>
            <label htmlFor="email" className="label">Ton adresse e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="alert" role="alert">{error}</p>}
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir un lien de connexion'}</button>
            <p className="muted small">Pas de mot de passe : tu reçois un lien par e-mail. Seules les adresses déclarées comme organisateurs ont accès.</p>
          </form>
        )}
      </div>
    </main>
  );
}

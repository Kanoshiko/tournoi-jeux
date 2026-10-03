import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Club de jeux</p>
        <h1>Tournoi par équipes</h1>
        <p>Les inscriptions arrivent bientôt.</p>
      </header>
      <section className="card">
        <p>
          Le site est en construction. La page <Link to="/diagnostic">Diagnostic</Link> vérifie que
          tout est bien branché.
        </p>
      </section>
    </main>
  );
}

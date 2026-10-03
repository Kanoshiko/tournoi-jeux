# Tournoi de jeux

Application d'inscription et de gestion du tournoi par équipes du club.

- Les joueurs s'inscrivent sur mobile (pseudo + niveau 1–10) et voient leur équipe, leur table et le classement en direct.
- Les admins gèrent le catalogue de jeux, génèrent la répartition, l'ajustent, la publient et saisissent les résultats.

Les règles de composition (tables homogènes, équipes mixtes, barème normalisé) sont décrites dans le document de règles du projet.

## Technologies

| Rôle | Outil |
| --- | --- |
| Interface | React + TypeScript, construit avec Vite |
| Base de données, connexion admin, temps réel | Supabase (projet `tournoi-jeux`, région Paris) |
| Hébergement | Netlify, redéploiement automatique à chaque commit sur `main` |
| Tests | Vitest (`src/**/*.test.ts`) |

## Organisation

```
src/
  algo/          répartition et barème (TypeScript pur, testé)
  lib/           connexion à Supabase
  pages/         écrans
supabase/migrations/   schéma de la base, règles d'accès (RLS) et fonctions
```

## Développer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé publishable du projet Supabase
npm run dev                  # http://localhost:5173
npm test
```

La page `/diagnostic` vérifie que le site parle bien à la base.

Site en ligne : https://tournoi-jeux.netlify.app (diagnostic : https://tournoi-jeux.netlify.app/diagnostic)

## Secrets

- **Dans le navigateur** : seulement l'URL du projet et la clé *publishable* Supabase. Elles sont publiques par conception ; la protection des données repose sur les règles RLS de la base.
- **Jamais dans ce dépôt ni dans le site** : la clé *secret* / *service_role* et le mot de passe de la base. L'application n'en a pas besoin.
- **En ligne** : les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont définies dans les variables d'environnement du site Netlify.
- **En local** : dans `.env.local`, ignoré par Git.

## Base de données

Les fichiers de `supabase/migrations/` sont appliqués dans l'ordre. Pour recréer la base à l'identique sur un nouveau projet Supabase, il suffit de les rejouer.

Les admins sont les e-mails listés dans la table `admins` ; ils se connectent par lien magique.

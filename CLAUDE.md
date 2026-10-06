# Tournoi de jeux — contexte pour Claude Code

Application du club de jeux de société pour organiser un tournoi par équipes (~40 joueurs).
Interface et textes **en français**. Joueurs sur mobile (lien posté sur Discord), admins sur ordinateur.

- Site : https://tournoi-jeux.netlify.app · admin : `/admin` · diagnostic : `/diagnostic`
- Base : Supabase, projet `tournoi-jeux` (ref `rwuvnhofpjbthkjymnui`, région Paris)
- **La base de production contient de vraies inscriptions** (tournoi « Tournoi DDJ 2026 »).
  Ne jamais vider ni réinitialiser des tables sans accord explicite. Faire les essais dans une
  transaction annulée (`begin; … rollback;`).

## Spécification : `docs/regles.md` (à tenir à jour)

`docs/regles.md` est la **source de vérité** des règles du tournoi ; le résumé ci-dessous n'en est
qu'un aide-mémoire.

- Toute décision qui change une règle ou un comportement visible (barème, formation des tables,
  champs, limites, parcours joueur ou admin) est reportée dans `docs/regles.md` **dans le même
  commit** que le code : modifier la section concernée, la liste « Décisions validées » si besoin,
  et ajouter une ligne datée dans « Historique des mises à jour ». Mettre aussi à jour le résumé
  ci-dessous s'il est touché.
- Si une demande contredit `docs/regles.md`, le signaler et demander laquelle des deux fait foi
  avant de coder.
- Une fonctionnalité n'est **finie** que si elle est testée, en ligne, et la spécification à jour.
- À chaque grande étape (fin d'une ligne de « Prochaines étapes »), relire `docs/regles.md` en
  regard du code et signaler tout écart.
- Le document partagé sur claude.ai (projet « Tournoi de jeu de société ») est une copie de
  lecture : rappeler à l'utilisateur de le resynchroniser quand `docs/regles.md` change.

## Règles du tournoi (résumé)

- Niveau des joueurs et complexité des jeux sur la même échelle 1–10 :
  Familial 1–3, Initié 4–6, Expert 7–10 (`src/lib/levels.ts`). Sur le curseur d'inscription,
  les joueurs voient « Petit / Moyen / Gros » (`signupLabel`), volontairement peu compétitif.
- **Tables homogènes** : joueurs triés par niveau puis découpés en paquets voisins.
  Tables de 4 en priorité, 3 ou 5 pour absorber le reste ; jamais plus de joueurs que d'équipes.
- **Jeux** : compatibles avec la taille de table (min/max) et à ± tolérance (défaut 2) du niveau
  moyen ; un exemplaire = une table ; pas de jeux coopératifs.
- **Sous-manches** : table familiale (niveau moyen ≤ 3,5) dont le jeu est familial et dure ≤ 30 min
  → 2 parties sur 2 jeux différents, mêmes joueurs ; score joueur = moyenne des deux.
- **Équipes mixtes** (couleurs auto, `src/lib/teams.ts`) : deux coéquipiers jamais à la même table
  (contrainte `unique (table_id, team_id)` dans `seats`), tailles égales à 1 près.
- **Barème** : points = 1 + 3 × (n − rang) / (n − 1) → 1er = 4, dernier = 1, moyenne 2,5 par table.
  Égalités : moyenne des points des places occupées (`src/algo/scoring.ts`).
- **Score d'équipe = moyenne** des points de ses membres ; départage au nombre de 1res places.
- Résultats saisis par les admins uniquement ; classement visible en direct par les joueurs.

## Stack et commandes

React 19 + TypeScript + Vite, React Router, `@supabase/supabase-js`, Vitest. Pas de framework CSS
(`src/styles.css`, variables de couleur sur `:root`).

```bash
npm install
cp .env.example .env.local   # URL + clé publishable Supabase (publiques par conception)
npm run dev
npm test                     # Vitest, src/**/*.test.ts
npm run build                # tsc + vite build
```

Toujours lancer `npm test` et `npm run build` avant de commiter.

## Organisation

```
src/algo/        distribution.ts (répartition), draft.ts (brouillon admin + contrôles),
                 scoring.ts (barème), util.ts (algorithme hongrois, PRNG) — TypeScript pur, testé
src/lib/         supabase.ts, api.ts (appels joueur), adminApi.ts, auth.ts (lien magique),
                 levels.ts, games.ts (validation jeu), teams.ts, playerStore.ts (localStorage)
src/components/  Hero, LevelPicker, AssignmentView
src/pages/joueur/  Inscription, MonInscription (/moi/:token), Jeux, Retrouver
src/pages/admin/   AdminLayout (garde admin), Login, Tournoi, Jeux, Inscrits, Repartition
supabase/migrations/  schéma, RLS et fonctions — appliqués dans l'ordre
docs/regles.md   spécification des règles du tournoi (source de vérité)
```

## Sécurité (à préserver)

- Le navigateur n'a que la clé **publishable**. Jamais de clé `service_role`/secret dans le code,
  le dépôt ou Netlify.
- Toutes les tables ont la RLS. Lecture publique : `tournaments`, `games`. Le reste : admins seuls.
- Admin = e-mail présent dans `public.admins`, testé par `private.is_admin()` (schéma `private`
  non exposé). Ajouter un admin : `insert into public.admins (email) values ('…');` (minuscules).
- Les joueurs n'ont pas de compte. Ils passent par des fonctions `security definer` du schéma
  `public` (`sign_up_player`, `get_player`, `update_player`, `delete_player`, `find_player`,
  `player_count`, `get_my_assignment`), identifiés par un **jeton UUID secret** (`players.token`)
  porté dans l'URL `/moi/:token`. L'**animal secret** (unique par tournoi) + pseudo sert seulement
  à retrouver ce jeton.
- Fonctions admin `security definer` : elles commencent par `if not private.is_admin() then raise`.
  `save_distribution` refuse de remplacer une répartition dès qu'un résultat existe.
- Après chaque migration : `get_advisors` (sécurité) et un test des droits en rôle `anon` /
  `authenticated` dans une transaction annulée.

## Migrations et déploiement

- `main` est déployé automatiquement par Netlify (le build lance aussi les tests ; il échoue si
  les variables `VITE_SUPABASE_*` manquent).
- Nouvelle migration = nouveau fichier `supabase/migrations/AAAAMMJJHHMMSS_nom.sql`.
- **Ordre** : appliquer la migration sur Supabase *avant* de pousser sur `main` du code qui en
  dépend. Si la migration casse l'ancien code, travailler sur une branche, appliquer, puis fusionner.
- Préférer les migrations additives (nouvelles fonctions/colonnes) ; éviter `drop` quand on peut.
- Si l'outil MCP Supabase ne peut pas appliquer une migration, donner le fichier à coller dans
  le SQL Editor : https://supabase.com/dashboard/project/rwuvnhofpjbthkjymnui/sql/new

## Conventions UI

- Français, tutoiement côté joueur. Pas d'emoji.
- Mobile d'abord pour les pages joueur (cibles ≥ 44 px), pages admin fluides (≥ 700 px : menu latéral).
- Accessibilité : vrais `<button>`/`<label>`, `role="alert"` pour les erreurs, contraste ≥ 4,5:1
  (`textOn()` choisit la couleur de texte sur une couleur d'équipe).
- Polices : Bricolage Grotesque (titres), Atkinson Hyperlegible (texte).

## État et prochaines étapes

Fait : inscription joueur, animal secret, espace admin (connexion par lien magique, tournoi,
catalogue, inscrits), algorithme de répartition, écran Répartition (ajustements, retardataires,
enregistrer, publier), vue joueur équipe + table.

À faire, dans l'ordre :
1. **Saisie des résultats** (admin) : places par table, 2 sous-manches pour les tables
   familiales, égalités ; table `results` déjà créée (`table_id, player_id, sub_round, rank`).
2. **Classement en direct** : fonction publique qui calcule les moyennes d'équipe
   (réutiliser `src/algo/scoring.ts` côté client ou recoder en SQL), page joueur « Classement »
   avec Supabase Realtime ou rafraîchissement, vue plein écran pour vidéoprojecteur.
3. Écran admin « Organisateurs » (ajouter/retirer un admin).
4. Statut « terminé » et annonce de l'équipe gagnante.
5. E-mail de connexion en français (modèle dans Supabase → Authentication → Email templates).

Règles : `docs/regles.md`. Maquettes et guide organisateur : projet claude.ai
« Tournoi de jeu de société ».

# Tournoi jeux de société – Règles de composition

> **Source de vérité des règles du tournoi.** Toute décision qui change une règle se reporte ici,
> dans le même commit que le code qui l'applique (voir `CLAUDE.md`). Le document partagé sur
> claude.ai en est une copie de lecture, resynchronisée à chaque grande étape.

## Principe du tournoi

On joue contre des gens de son niveau, mais on gagne en équipe avec des joueurs de tous niveaux.

- **Les tables sont homogènes** : les joueurs y sont regroupés par niveau proche, autour d'un jeu adapté.
- **Les équipes sont mixtes** : chacune a des membres répartis sur des tables de tous niveaux.
- **Chaque joueur marque des points** selon son classement à sa table.
- **Le score d'une équipe est la moyenne** des points de ses membres.

Ce format lève la contrainte des 20 joueurs : le nombre de participants, le nombre d'équipes et la taille des tables deviennent libres.

## Données

Un joueur est décrit par quatre champs, un jeu par cinq.

**Joueur**

| Champ | Valeurs | Remarque |
| --- | --- | --- |
| Pseudo | Texte libre, 30 caractères max | Unique dans le tournoi (majuscules et espaces ignorés) |
| Niveau | 1 à 10 | Curseur à repères. Le joueur voit « Petit » (1–3), « Moyen » (4–6), « Gros » (7–10) ; les organisateurs voient Familial, Initié, Expert |
| Animal secret | Attribué au hasard | Unique dans le tournoi, parmi 90 animaux. Avec le pseudo, il permet de retrouver son inscription ; majuscules et accents ignorés |
| Lien personnel | Généré | Jeton secret dans l'adresse de la page du joueur : c'est lui qui donne accès à l'inscription |

**Jeu** (saisi par les admins)

| Champ | Valeurs | Remarque |
| --- | --- | --- |
| Nom | Texte, 80 caractères max | Un exemplaire par ligne : un jeu possédé en double s'ajoute deux fois |
| Complexité | 1 à 10 | Même échelle que les joueurs |
| Joueurs min | 1 à 10 | La fourchette min–max doit permettre une table de 3, 4 ou 5 joueurs |
| Joueurs max | 1 à 10 | Supérieur ou égal au minimum |
| Durée | 5 à 600 minutes | Un jeu familial (complexité 1 à 3) de 30 minutes ou moins est joué en deux sous-manches |

Les jeux coopératifs sont exclus du catalogue, car ils ne donnent pas de classement individuel.

## Formation des tables

Les tables font 4 joueurs en priorité. Quelques tables de 3 ou 5 absorbent le reste, là où le catalogue a un jeu qui s'y prête.

1. **Trier** les joueurs par niveau, du plus fort au plus faible. Les égalités sont départagées par tirage au sort.
2. **Choisir les tailles** de table selon le reste de la division du nombre de joueurs N par 4 :
   - reste 0 : uniquement des tables de 4 ;
   - reste 1 : une table de 5 ;
   - reste 2 : deux tables de 5, ou à défaut deux tables de 3 ;
   - reste 3 : une table de 3, ou à défaut trois tables de 5.
3. **Découper** la liste triée en paquets consécutifs de ces tailles. Chaque table regroupe donc des niveaux voisins.
4. **Placer les tables irrégulières** là où un jeu les accepte. L'algorithme essaie chaque position possible et garde celle où toutes les tables reçoivent un jeu compatible. En pratique, les jeux familiaux acceptent souvent 5 joueurs, les jeux experts plutôt 3. Si cela permet à chaque table d'avoir un jeu, l'algorithme peut ajouter une table irrégulière de plus.

Une table ne peut pas compter plus de joueurs qu'il n'y a d'équipes, sinon deux coéquipiers s'y retrouveraient. Avec 4 équipes, les tables de 5 sont donc exclues et le reste est absorbé par des tables de 3.

## Attribution des jeux

Chaque table reçoit le jeu dont la complexité est la plus proche de son niveau moyen, parmi ceux qui acceptent son nombre de joueurs.

Un jeu est compatible avec une table si :

- son nombre de joueurs min–max inclut la taille de la table ;
- sa complexité est à **2 points maximum** du niveau moyen de la table (tolérance réglable par l'admin, de ±1 à ±3) ;
- il n'est pas déjà pris par une autre table (un exemplaire par ligne du catalogue).

L'algorithme cherche la répartition qui minimise l'écart total entre complexités et niveaux. Si une table n'a aucun jeu compatible, l'admin est alerté : il peut élargir la tolérance, choisir un jeu à la main ou ajouter un jeu au catalogue.

## Composition des équipes

L'admin choisit le nombre d'équipes. La seule règle stricte est que deux coéquipiers ne se retrouvent jamais à la même table.

**Règles**

- Nombre d'équipes : choisi par l'admin, de 3 à 8 (4 par défaut). Il fixe la taille maximale des tables : avec 4 équipes, l'algorithme ne forme pas de table de 5.
- Coéquipiers jamais à la même table, sous-manches comprises.
- Tailles d'équipe égales à 1 joueur près. Chaque équipe reçoit automatiquement une couleur en guise de nom.

**Méthode**

1. Parcourir les tables de la plus forte à la plus faible.
2. Pour chaque joueur, choisir parmi les équipes pas encore présentes à sa table.
3. Prendre celle qui a le moins de membres, puis celle dont le total de niveaux est le plus bas. Les égalités se départagent au hasard.

Chaque équipe se retrouve ainsi avec des membres sur des tables de tous niveaux. Quand il y a plus d'équipes que de places à une table, certaines équipes en sont absentes. Ce n'est pas un problème, puisque le score est une moyenne.

## Barème et score

Le premier d'une table marque toujours 4 points et le dernier 1 point, quelle que soit la taille de la table. Ainsi aucune table n'est avantagée.

Points d'un joueur classé au rang r sur une table de n joueurs :

```
points = 1 + 3 × (n − r) / (n − 1)
```

| Taille de table | 1er | 2e | 3e | 4e | 5e |
| --- | --- | --- | --- | --- | --- |
| 3 joueurs | 4 | 2,5 | 1 | | |
| 4 joueurs | 4 | 3 | 2 | 1 | |
| 5 joueurs | 4 | 3,25 | 2,5 | 1,75 | 1 |

La moyenne d'une table vaut toujours 2,5 points. En cas d'égalité, les joueurs concernés se partagent la moyenne des points des places qu'ils occupent.

**Sous-manches familiales.** Une table familiale (niveau moyen de 3,5 ou moins) dont le jeu est familial (complexité 1 à 3) et dure 30 minutes ou moins joue deux sous-manches sur deux jeux différents, avec les mêmes joueurs (pas de remélange, pour ne pas perdre de temps). Le score du joueur est la moyenne de ses deux résultats, ce qui lui donne le même poids que les autres joueurs. Un jeu court d'une autre catégorie, comme Splendor (complexité 4, 30 minutes) sur une table initiée, ne déclenche pas de deuxième partie.

**Score d'équipe** = moyenne des scores de ses membres. En cas d'égalité, l'équipe qui a le plus de premières places l'emporte.

## Exemple : 18 joueurs, 4 équipes

Avec 18 joueurs, il reste 2 joueurs après les tables de 4. Comme il n'y a que 4 équipes, les tables de 5 sont exclues : on forme 3 tables de 4 et 2 tables de 3.

**Tables**

| Table | Niveaux | Jeu attendu |
| --- | --- | --- |
| 1 | 10, 9, 8, 8 | Complexité 7 à 10, 4 joueurs |
| 2 | 7, 7, 6, 6 | Complexité 5 à 8, 4 joueurs |
| 3 | 5, 5, 5, 4 | Complexité 3 à 7, 4 joueurs |
| 4 | 4, 3, 3 | Complexité 1 à 5, 3 joueurs |
| 5 | 2, 1, 1 | Complexité 1 à 3, 3 joueurs, rapide : 2 sous-manches |

**Équipes obtenues avec la méthode**

| Équipe | Membres | Niveaux | Total |
| --- | --- | --- | --- |
| A | 4 | 10, 6, 4, 4 | 24 |
| B | 5 | 9, 6, 5, 3, 1 | 24 |
| C | 5 | 8, 7, 5, 3, 1 | 24 |
| D | 4 | 8, 7, 5, 2 | 22 |

Aucune équipe n'a deux membres à la même table, et les totaux de niveau sont presque identiques.

**Score de l'équipe A.** Ses membres terminent 2e à la table 1 (3 pts), 1er à la table 2 (4 pts), 4e à la table 3 (1 pt) et 2e à la table 4 (2,5 pts). Sa moyenne est donc (3 + 4 + 1 + 2,5) / 4 = 2,63 points.

## Déroulé de la soirée

L'admin génère la répartition, la vérifie, puis la publie. Les joueurs ne voient rien avant la publication.

**Côté admin**

1. Créer la session : date, nombre d'équipes, tolérance de complexité.
2. Tenir à jour le catalogue de jeux.
3. Ouvrir les inscriptions et partager le lien ou un QR code.
4. Clôturer les inscriptions et générer les tables, les jeux et les équipes.
5. Ajuster à la main si besoin, y compris pour les retards et les absents : déplacer, ajouter ou retirer un joueur, changer un jeu.
6. Publier.
7. Saisir (admin uniquement) le classement de chaque table, et de chaque sous-manche pour les tables familiales.
8. Annoncer l'équipe gagnante une fois tous les résultats saisis.

**Côté joueur**

1. S'inscrire avec un pseudo et un niveau choisi au curseur (Petit, Moyen ou Gros). Le joueur reçoit un animal secret et un lien personnel, mémorisé par son téléphone.
2. Tant que les inscriptions sont ouvertes : modifier son pseudo ou son niveau, ou se désinscrire.
3. Sur un autre téléphone : retrouver son inscription avec son pseudo et son animal secret.
4. Avant publication : voir que les équipes sont en préparation, et consulter les jeux du tournoi pour s'entraîner.
5. Après publication : voir son équipe (couleur, coéquipiers et leurs tables) et sa table (numéro, jeu, adversaires). La page se rafraîchit chaque minute.
6. Pendant la soirée : suivre en direct le classement des équipes, mis à jour à chaque résultat saisi.

## Décisions et historique

**Décisions validées**

- Score d'équipe = moyenne des points de ses membres.
- Tables de 3 à 5 joueurs selon le nombre min–max de chaque jeu.
- Une seule manche, sauf deux sous-manches pour les tables familiales dont le jeu est familial et dure 30 minutes ou moins.
- Pas de remélange entre les sous-manches familiales.
- Pas de jeux coopératifs.
- Un exemplaire par ligne du catalogue ; un jeu possédé en double s'ajoute deux fois.
- Tolérance de complexité de ±2 par défaut, réglable de ±1 à ±3 par l'admin.
- Équipes nommées par une couleur attribuée automatiquement.
- Animal secret (un par joueur, parmi 90) à la place du code à 4 chiffres : plus facile à retenir ; il peut se deviner si l'on connaît le pseudo, compromis accepté pour un club.
- Libellés « Petit, Moyen, Gros » sur le curseur d'inscription, volontairement peu compétitifs.
- Retards et absents gérés à la main par l'admin.
- Résultats saisis par l'admin uniquement.
- Classement des équipes visible en direct.

**Historique des mises à jour**

- 6 octobre 2026 : règles déplacées dans le dépôt (`docs/regles.md`), qui devient la source de vérité.
- 6 octobre 2026 : document aligné sur le code. Sous-manches réservées aux jeux familiaux, animal secret et lien personnel, libellés du curseur, limites des champs, nombre d'équipes réglable, hypothèses confirmées par l'implémentation.
- 3 octobre 2026 : première version, issue des échanges sur les règles.

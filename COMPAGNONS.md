# MONEY QUEST — choix du compagnon (cahier des charges)

> Prompt : « Au tout premier lancement, juste après l'animation d'ouverture, l'utilisateur choisit sa mascotte parmi 4
> (chat, loutre, lion, renard). Écran plein, une seule fois. Le choix remplace le renard partout dans l'app
> et reste modifiable dans Réglages. Qualité app pro, animations selon ANIMATIONS.md. »

## Données
- `settings.mascot?: 'chat' | 'loutre' | 'lion' | 'renard'` : absent = l'écran de choix s'affiche.
- `SCHEMA_VERSION` 2 → 3, migration sans changement (les utilisateurs existants choisiront une fois) + test.
- `validateData` : une valeur inconnue est ignorée (remise à vide).

## Images
- `public/compagnons/{chat,loutre,loutre-coucou,lion,renard}.webp`, 512 px de haut, compressées (≈ 40 Ko chacune).
- La loutre utilise la pose « coucou » pour saluer (accueil, écran de choix).

## Écran de choix (après le lancement)
- Titre « Choisis ton compagnon », sous-titre « Il t'accompagnera dans ton budget. Tu pourras le changer dans Réglages. »
- Grille 2 × 2 de cartes (image + nom) qui arrivent en cascade (montée 14 px, décalage 60 ms).
- Carte choisie : ressort à 1,04, contour coloré, la mascotte fait un petit saut.
- Bouton en bas « C'est parti avec le lion ! » (désactivé tant que rien n'est choisi), puis fondu vers l'accueil.

## Affichage
- Composant `Mascot` (image + balancement doux existant `fox-bob`) remplace `Fox` dans Accueil, Mon Argent et la célébration.
- Réglages : section « Mon compagnon » avec les 4 choix.

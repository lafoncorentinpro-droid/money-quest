# MONEY QUEST — cahier des charges des animations

> Prompt de référence : « Animations d'une app iOS pro : courtes, fluides, avec un sens (elles expliquent d'où vient l'écran),
> jamais bloquantes, 60 i/s (uniquement `transform` et `opacity`), et désactivées si l'utilisateur coupe les animations
> (Réglages → Animations) ou si iOS demande de réduire les animations. »

## Courbes et durées (tokens CSS)
| Token | Valeur | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entrées d'écran, apparitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | feuille du +, icônes, logo (léger rebond) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | sorties |
| Durées | 180 ms (micro), 340 ms (écran), 450 ms (feuille), 1,6 s (lancement) | |

## 1. Lancement de l'app (≈ 1,6 s, une fois par ouverture)
1. Fond crème plein écran, l'icône apparaît : échelle 0,6 → 1,06 → 1, flou 10 px → 0, opacité 0 → 1 (600 ms, ressort).
2. Un halo doré s'échappe derrière l'icône (échelle 0,8 → 1,7, opacité 0,5 → 0, 900 ms).
3. « MONEY QUEST » monte lettre par lettre (décalage 35 ms, 450 ms chacune).
4. Le slogan apparaît en fondu.
5. Sortie : l'écran se dissout (opacité → 0, échelle 1 → 1,04, 400 ms) et révèle l'accueil, dont les cartes arrivent en cascade.
- Pas rejoué au simple rechargement dans la même session ; version courte (fondu 300 ms) si animations réduites.

## 2. Changement d'onglet / d'écran (340 ms)
- Sens spatial : aller « plus loin » (Accueil → Mon Argent → sous-page) = l'écran arrive de la droite (+28 px) ; revenir = arrive de la gauche.
- Les cartes de l'écran arrivent en cascade (montée de 14 px + fondu, décalage 35 ms, 8 cartes max).
- Barre d'onglets : une pastille glisse sous l'onglet actif (ressort 420 ms) ; l'icône active fait un petit « pop » (0,85 → 1,12 → 1).

## 3. Bouton + et feuilles
- Le + tourne de 45° (il devient ×) tant qu'une feuille est ouverte, et s'enfonce au toucher (0,92).
- Fond assombri + flou en fondu (250 ms).
- La feuille monte du bas avec un léger rebond (450 ms, ressort) ; ses choix arrivent en cascade (décalage 45 ms).
- Fermeture (×, fond, Échap) : la feuille redescend (220 ms, `--ease-in`) avant de disparaître.

## 4. Détails
- Le montant « Il te reste » de l'accueil compte jusqu'à sa valeur (700 ms) à l'ouverture.
- Boutons : enfoncement 0,97 au toucher.

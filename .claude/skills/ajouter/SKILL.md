---
name: ajouter
description: Ajoute une fonctionnalité à MONEY QUEST proprement (logique testée d'abord, puis interface iOS, puis vérification iPhone 13 mini). À utiliser quand l'utilisateur demande une nouvelle fonction, un nouvel écran ou une évolution, ou tape /ajouter.
argument-hint: description de la fonctionnalité
---

Fonctionnalité demandée : $ARGUMENTS

1. Si la demande est ambiguë sur un point qui change le résultat, pose **une seule** question courte avant de coder. Sinon, choisis l'option la plus simple et dis-la en une ligne.
2. Respecte les règles métier et UI de CLAUDE.md (centimes, calculs dans `finance.ts`, épargne ≠ dépense, tokens CSS iOS, `<Icon>`, textes FR bienveillants).
3. Ordre de travail :
   a. Modèle/calculs dans `src/domain/` + tests dans `tests/` (si le modèle change : `SCHEMA_VERSION` + migration).
   b. Actions dans `src/store/reducer.ts` si besoin.
   c. Interface en réutilisant les composants existants (`Sheet`, `Field`, `Progress`, `PageHead`, `MonthStrip`, `StepNav`…).
4. `npx tsc --noEmit -p .` + `npm test`.
5. Une seule vérification au format 375×812 : pas de débordement horizontal, zones tactiles ≥ 44 px (via JS dans la page). Une capture d'écran au maximum.
6. Réponse courte : ce qui a été ajouté, où le trouver dans l'app, puis « Je publie ? ».

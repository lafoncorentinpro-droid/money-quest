---
name: corriger
description: Corrige un bug de MONEY QUEST de façon économe (diagnostic ciblé, correction minimale, test). À utiliser quand l'utilisateur signale un problème, une erreur, un calcul faux ou tape /corriger.
argument-hint: description du problème
---

Problème signalé : $ARGUMENTS

Méthode économe :
1. Utilise la carte du code de CLAUDE.md pour ouvrir **uniquement** les fichiers concernés (Grep ciblé, pas d'exploration large).
2. Si c'est un calcul : écris d'abord un test qui reproduit le bug dans `tests/` (il doit échouer), puis corrige dans `src/domain/` — jamais dans un composant.
3. Correction **minimale** avec `Edit` ; ne touche pas au reste.
4. `npx tsc --noEmit -p .` + `npm test`.
5. Vérification navigateur seulement si le bug est visuel : texte de la page (get_page_text / JS) au format 375×812, capture d'écran seulement si indispensable.
6. Réponse : cause en 1 phrase, correction en 1 phrase, puis demande « Je publie ? » (ou publie directement si l'utilisateur l'a déjà demandé, via la méthode de /publier).

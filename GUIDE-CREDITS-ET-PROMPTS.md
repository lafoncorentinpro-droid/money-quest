# Guide : travailler avec Claude en économisant des crédits

## Les 7 règles d'or

1. **Une session = une tâche.** Claude relit toute la conversation à chaque message : plus elle est longue, plus chaque message coûte cher. Nouveau sujet → nouvelle session (dans le dossier `Documents\MONEY QUEST\money-quest`).
2. **Tout dire en un seul message**, puis attendre la fin. Les petits messages envoyés pendant que Claude travaille l'obligent à reprendre le fil.
3. **Le bon modèle pour la bonne tâche** (sélecteur de modèle de l'app, avant d'envoyer) :
   | Tâche | Modèle |
   |---|---|
   | Petite correction, texte, couleur, ajout simple, publier | **Sonnet** (bien moins cher) |
   | Nouvelle fonctionnalité importante, refonte, calculs délicats | **Opus** |
4. **`/compact`** quand une session s'allonge : Claude la résume et repart plus léger.
5. **Désactive les connecteurs inutiles** pour coder (Canva, Figma, Gmail, vidéo, voix…) : leur description est envoyée à chaque message.
6. **Dis quand ne pas vérifier visuellement** : ajoute « pas besoin de capture d'écran ». Les images sont ce qui coûte le plus.
7. **Nomme l'écran ou le fichier** concerné : Claude cherche moins.

## Les raccourcis du projet

| Tape | Ce que ça fait |
|---|---|
| `/publier` | Teste, enregistre et met en ligne. Ton iPhone se met à jour tout seul. |
| `/corriger …` | Corrige un problème de façon ciblée. Ex. : `/corriger le total des dépenses est faux dans le bilan de novembre` |
| `/ajouter …` | Ajoute une fonctionnalité proprement. Ex. : `/ajouter un graphique camembert des dépenses dans le bilan` |

La fiche `CLAUDE.md` est lue automatiquement au début de chaque session : Claude connaît déjà le projet, inutile de le réexpliquer.

## Écrire un bon prompt : la recette

**Où** + **quoi** + **résultat attendu** + **contraintes** (facultatif).

❌ « Améliore l'app »
✅ « Dans Mon argent → Dépenses, ajoute un bouton pour dupliquer une dépense au mois suivant. Pas besoin de capture d'écran. Publie après. »

❌ « Y'a un bug »
✅ « `/corriger` Dans Trésors, quand je retire 50 € de Vacances, le reste disponible du mois ne bouge pas. »

❌ « Change les couleurs »
✅ « Sur l'écran Accueil, mets le montant « Disponible estimé » en vert quand il est positif. Petite modif, Sonnet suffit. »

## Modèles de prompts à copier

**Petite modification visuelle**
> Sur l'écran [nom], change [élément] pour [résultat]. Pas besoin de capture d'écran. Publie après.

**Nouvelle fonctionnalité**
> /ajouter [description précise]. Ça doit apparaître dans [écran]. [Règle particulière éventuelle].

**Bug**
> /corriger Quand je [action] sur [écran], j'obtiens [ce que je vois] au lieu de [ce que j'attends].

**Plusieurs petites choses d'un coup** (moins cher que 3 sessions)
> Trois petites modifs, puis publie :
> 1. [modif 1]
> 2. [modif 2]
> 3. [modif 3]
> Pas besoin de vérifier visuellement.

**Question sans modification**
> Question rapide, ne modifie rien : [question]

## Ce qu'il vaut mieux éviter

- Enchaîner plusieurs sujets différents dans la même session.
- Envoyer des messages pendant que Claude travaille (attends la fin, ou écris tout d'avance).
- « Vérifie tout » sans préciser : Claude testera tous les écrans avec des captures.
- Changer le logo ou le nom de l'app : sur iPhone, il faut alors réinstaller (avec export/import de sauvegarde).

## Suivre sa consommation

- Demande « explique ma consommation » : Claude montre où sont partis les crédits de la session.
- Outil gratuit (non officiel) **ccusage** pour suivre ta consommation dans le temps : `npx ccusage`.

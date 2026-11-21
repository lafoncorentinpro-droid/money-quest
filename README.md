# MONEY QUEST 🦊

Application personnelle de budget et d'épargne, en aventure *cozy fantasy*.
Locale par défaut : **tes données restent sur ton appareil**, rien n'est envoyé sur internet.

---

## Lancer l'application sur ton PC

**Le plus simple :** double-clique sur `Lancer MONEY QUEST.bat`, puis ouvre http://localhost:5173.

Ou dans un terminal, depuis ce dossier :

```powershell
npm install        # une seule fois
npm run dev        # lance l'app sur http://localhost:5173
npm test           # lance les 40 tests (calculs + parcours)
npm run build      # fabrique la version finale dans dist/
```

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

## L'installer sur ton iPhone

Une application web installable (PWA) doit être servie en **HTTPS**. La façon la plus simple et gratuite :

1. `npm run build` → crée le dossier `dist/`.
2. Va sur https://app.netlify.com/drop (compte gratuit) et glisse-dépose le dossier `dist/`.
   (Alternatives gratuites : Cloudflare Pages, GitHub Pages, Vercel.)
3. Sur l'iPhone, ouvre l'adresse obtenue dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.

Le site n'est qu'un ensemble de fichiers statiques : l'hébergeur ne voit **aucune** de tes données, qui sont stockées uniquement dans le téléphone.

### Limites d'iOS à connaître
- Les données vivent dans le stockage de l'app installée. Si tu supprimes l'app ou effaces les données de Safari, elles disparaissent → **exporte une sauvegarde** (Profil → Mes données) régulièrement, par exemple dans Fichiers / iCloud Drive.
- Safari et l'app installée ont des stockages séparés.
- Pas de notifications programmées sans serveur d'envoi : les alertes (budget, échéances, rappel de saisie) s'affichent à l'ouverture de l'app.
- Pas de synchronisation entre appareils dans cette version : pour changer de téléphone, exporte puis importe la sauvegarde.

---

## Ce qui fonctionne

| Domaine | Fonctions |
|---|---|
| **Accueil (Mon QG)** | Disponible estimé + détail du calcul, revenus reçus, dépenses, épargne, prévision de fin de mois, alertes, échéances à confirmer, niveau, missions, objectifs, guide de démarrage |
| **Revenus** | Salaire, primes, remboursements, autres ; reçu / prévu / annulé ; récurrents ; historique conservé |
| **Dépenses** | 15 catégories + personnalisées, fixe/variable, réalisée/prévue/annulée, remboursements rattachés (sans double comptage), duplication, recherche, filtres, tri |
| **Récurrences** | Hebdo, mensuel, trimestriel, annuel ; date de fin ; suspension ; confirmation d'échéance ; ignorer une échéance ; **aucun doublon** |
| **Budget** | Limites par catégorie, objectif d'épargne, reste à vivre, catégories proches/dépassées, copie du mois précédent, **report explicite et tracé** |
| **Épargne (Trésors)** | Objectifs multiples, versements, retraits, transferts entre objectifs, historique, pause, célébration |
| **Statistiques** | Mois / trimestre / 12 mois / période libre, revenus vs dépenses, catégories, fixes vs variables, évolution de l'épargne, moyenne quotidienne, valeurs chiffrées |
| **Bilan mensuel** | Comparaison au mois précédent, top catégories, objectifs, points positifs et pistes sans jugement |
| **Calendrier** | Opérations confirmées et prévues, ouverture d'une opération |
| **Simulateur** | Atteinte d'un objectif, date d'achat, dépense exceptionnelle (rien n'est modifié sans confirmation) |
| **Jeu** | XP sur les habitudes (jamais sur les montants), niveaux 1-100, 5 régions avec brouillard, objets à collectionner, missions, badges, garde-robe du renard |
| **Profil** | Pseudo, devise, début du mois budgétaire, thème clair/sombre, animations, alertes, règles d'XP réglables, export JSON/CSV, import validé avec aperçu, réinitialisation |

## Règles de calcul (src/domain/finance.ts)

- Montants stockés en **centimes entiers** (jamais de nombres à virgule).
- **Disponible estimé** = report éventuel + solde de départ + revenus reçus − dépenses réalisées (nettes des remboursements) − (versements − retraits d'épargne).
- Un versement vers un objectif est un **transfert interne**, pas une dépense. Un retrait n'est pas un revenu. Un transfert entre objectifs est neutre.
- Une opération **prévue** ou **annulée** n'entre pas dans les totaux réalisés.
- **Reste à vivre** = revenus (reçus + attendus) − charges fixes (payées + prévues) − objectif d'épargne.
- Ce n'est **pas** un solde bancaire : l'application n'est pas reliée à ta banque.

## Organisation du code

```
src/
  domain/      ← logique pure et testée (aucune interface)
    types.ts       modèles de données
    finance.ts     TOUS les calculs financiers
    recurring.ts   échéances récurrentes sans doublon
    game.ts        XP, niveaux, régions, missions, badges
    backup.ts      export/import validé, CSV, migrations
    dates.ts money.ts defaults.ts
  store/       ← réducteur (toutes les modifications) + stockage IndexedDB
  forms/       ← formulaires de saisie
  pages/       ← écrans (Accueil, Monde, Mon Argent, Trésors, Profil)
  ui/          ← composants, mascotte SVG, navigation
tests/         ← 40 tests (calculs, cas particuliers, parcours complets)
```

## Remplacer les visuels par tes illustrations

La mascotte (`src/ui/Fox.tsx`), la carte (`src/pages/World.tsx`) sont dessinées en SVG pour que l'app fonctionne tout de suite.
Quand tu auras créé tes images avec `PROMPTS_VISUELS_MONEY_QUEST.md` :

1. Place-les dans `public/assets/` (PNG transparent ou SVG, sans texte).
2. Remplace le contenu SVG par `<img src="./assets/renard-accueil.png" alt="Le renard aventurier" />` (ou la carte par `<image href="./assets/carte.png" …/>` dans le SVG pour garder les zones cliquables).
3. Pour l’icône : modifie `public/icon-source.svg` (logo 3D) puis lance `npm run icons`, qui fabrique toutes les tailles.

## Pas encore inclus (versions futures)
- Synchronisation entre appareils (nécessiterait un serveur).
- Notifications push programmées sur iPhone (nécessiterait un serveur d'envoi).
- Illustrations peintes définitives (les SVG actuels sont des placeholders soignés).

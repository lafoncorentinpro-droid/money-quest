# À faire — nouvelle animation de lancement (demandée le 21/11/2026)

Cahier des charges fourni par l'utilisateur (résumé fidèle, à réaliser en CSS/SVG dans l'app, pas en Lottie) :

- Durée 2,8 s, passable d'un toucher après 1 s ; fond #F5F0E5 au début et à la fin (sombre : #15232F).
- 0–0,4 s : trois collines (bleu nuit #29465D, bleu doux #7899B5, glacier #DCEBF5) montent du bas en parallaxe, soleil-pièce d'or flou en fondu.
- 0,4–1,1 s : pièce d'or 3D étoilée (#E6C372 / ombre #B58A2F) tombe au centre, rebond squash & stretch, demi-tour avec reflet.
- 1,1–1,7 s : le compagnon choisi (renard par défaut ; loutre, chat, lion) surgit de derrière la colline, attrape la pièce, clin d'œil, queue en balancier.
- 1,7–2,3 s : « MONEY QUEST » lettre par lettre (30 ms, rebond), police arrondie bleu nuit ; slogan « Ton budget, en aventure cosy » en #7899B5 ; 3 étincelles dorées.
- 2,3–2,8 s : léger zoom, montagnes vers le bas, compagnon + logo montent vers le titre de l'accueil.
- Courbes : apparitions cubic-bezier(.22,1,.36,1), rebonds (.34,1.4,.64,1), sorties (.4,0,1,1) ; respiration 1 → 1,02 à l'arrêt ; jamais plus de 2 éléments en fort mouvement.
- Son optionnel (tintement 0,6 s, carillon 1,8 s), coupé en silencieux.
- Réduire les animations : simple fondu 400 ms. Interdits : néons, casino, pluie de billets, confettis excessifs.

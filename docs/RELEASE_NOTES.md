# PulSe V1.1.1

Première publication versionnée du compagnon mobile **LinKs PulSe**, dans son dépôt autonome.

## Inclus
- PWA mobile et installation sur écran d’accueil.
- Tableau de bord des clics avec périodes 7 et 30 jours, histogramme lisible et accessible sur mobile.
- Préparation des Stories : vidéo YouTube récente, offres et liens indépendants suivis, image verticale et média local.
- Parcours de publication guidé : préparer, copier le lien suivi, partager le média, puis ajouter manuellement le sticker Lien dans Instagram.
- Application Docker indépendante, authentification HTTP, proxy limité, données privées non mises en cache.

## Docker
Image de release versionnée : `ghcr.io/mick7784/links-pulse:1.1.1` (AMD64 et ARM64).
La publication ne déploie **aucun** conteneur et ne modifie **aucune** stack Dockhand ou Pangolin.

## Prérequis
- LinKs **V1.316**, avec extension PulSe effectivement déployée côté LinKs.
- Conserver les variables et le secret partagé `PULSE_BRIDGE_TOKEN` du déploiement existant, sans jamais les publier.

## Points à connaître
- Cette version conserve l’identité **PulSe en texte** et la charte navy/bleu électrique : le nouveau logo multicolore et la refonte graphique ultérieure ne sont **pas inclus**.
- L’ouverture de la Story et sa publication dans Instagram restent des actions manuelles ; le partage système ne prouve pas une publication.
- Les tests de navigation utilisent des fixtures et un partage simulé. Validation physique Samsung/iOS encore à réaliser.

Voir le README et `docs/RECETTE.md` pour la recette et le retour arrière.

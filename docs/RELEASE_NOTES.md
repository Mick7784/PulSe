# PulSe V1.1.3 — Refonte mobile et liens LinKs

Publication du chantier PulSe validé sur la PR #4, compatible avec le moteur LinKs intégré dans la PR #55.

## Nouveautés

- Interface mobile repensée, avec logo officiel, navigation compacte et identité visuelle harmonisée avec LinKs.
- Gestion des liens suivis depuis le smartphone : création, modification, aperçu d'affiliation, partenaires automatiques/manuels, doublons et réutilisation, via le moteur unique LinKs.
- Préparation de Stories avec promotions éligibles, liens suivis ou dernière vidéo YouTube ; médias locaux et génération d'un visuel 1080 × 1920.
- Parcours YouTube et Discord : préparation de texte, copie et partage natif, suivi par source et confirmation manuelle de publication.
- Statistiques mobiles 7/30 jours, avec détail des liens et sources suivi par LinKs.
- PWA Android : icônes officielles, manifest, mises à jour explicites, protections des préparations en cours et cache limité aux seuls éléments publics.
- Correctifs d'ergonomie, d'affichage mobile et du repère des publications en préparation.

## Sécurité et compatibilité

- **LinKs V1.328 requis**, intégrant la passerelle privée PulSe et les nouvelles fonctionnalités de liens.
- Le secret de la passerelle LinKs reste exclusivement serveur-à-serveur. Aucune catégorie de lien ni base de données PulSe supplémentaire.
- **HTTP Basic est conservé.** L'activation du futur accès privé Pangolin/VPN reste un chantier séparé, à valider sur le VPS et le Samsung.
- Les médias et brouillons restent en mémoire ; une fermeture du processus Android peut les perdre.
- La publication de cette release **ne redéploie pas** l'application sur le VPS.

## Validation

- CI PulSe : 16 tests Node, navigation mobile/PWA et intégrations réelles HTTP PulSe–LinKs–SQLite.
- CI LinKs intégrée : suites Python, JS et navigateur ainsi que Docker AMD64/ARM64.
- Préservation vérifiée sur jeux de données de test : liens courts, partenaires, sources, tokens, compteurs et historiques.

## Images et déploiement

Image Docker : `ghcr.io/mick7784/links-pulse:1.1.3` (AMD64/ARM64).

Le déploiement sera organisé séparément avec la configuration réelle Dockhand/Pangolin après sauvegarde des paramètres existants. Conserver HTTP Basic et les secrets actuels.

**Retour arrière :** revenir à l'image `ghcr.io/mick7784/links-pulse:1.1.2` sans supprimer les volumes LinKs, jetons, liens courts ni statistiques.

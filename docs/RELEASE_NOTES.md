# PulSe V1.1.5 — candidat correctif privé

**Préparé, non publié. Ne pas installer sur une URL publique.** Publication manuelle seulement après validation technique, bilan d’isolation approuvé et contrôle de tous les consommateurs automatiques de latest. Aucun déploiement VPS.

- Stories au premier affichage HTML/JavaScript, après actualisation et réouverture ; Retour conserve la navigation entre vues.
- Icônes Android/PWA standard et maskable : S multicolore extrait du logo officiel ; header complet conservé.
- Liens : une ligne de 50 px, séparateurs discrets, crayon cyan et partage rose, boutons 44 × 44 px ; édition complète et choix pour Story conservés.
- Suppression de la connexion utilisateur intégrée et des identifiants devenus inutiles dans serveur, Docker, Compose, tests et guides. Accès exclusivement privé Pangolin à valider hors dépôt.
- Compose candidat sans ports hôte ni ancien alias public, découverte Traefik désactivée ; audit et ordre de bascule dans ACCES-PRIVE.md.
- PULSE_BRIDGE_TOKEN conservé, uniquement serveur à serveur ; protections CSRF, secrets exclus et refus des redirections conservés.
- LinKs V1.329 épinglé par digest, aucune migration ni modification des volumes ou jetons existants.
- Images prévues : ghcr.io/mick7784/links-pulse:1.1.5 et :latest, même digest AMD64/ARM64 ; versions immuables et garde contre les anciennes exécutions maintenus. Push/fusion ne publie plus automatiquement.

Validation exacte : voir VALIDATION-FINALE.md. Les tests Chrome et l’entrée privée HTTPS Traefik ne prouvent pas le fonctionnement du VPN, des droits réels ou du Samsung physique. Une PWA déjà installée peut garder son ancienne icône jusqu’à mise à jour des métadonnées ou réinstallation.

Retour arrière après intervention séparément autorisée : conserver le refus public, restaurer uniquement l’image/configuration PulSe validée par digest ; conserver LinKs V1.329, volumes et PULSE_BRIDGE_TOKEN. Aucune réouverture Internet automatique.

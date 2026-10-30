# PulSe V1.1.4 — mobile compact, statistiques du jour

- Navigation Stories → Liens → Stats ; header et navigation basse fixes, zones tactiles 44 px.
- Une ligne par lien avec modification/partage accessibles, choix Story conservé, recherche nom/URL.
- Clics aujourd'hui (tous les clics LinKs), comparaison explicitement « hier, journée complète ». Classements journaliers des liens suivis, détail à la demande. Pas de données horaires inventées.
- LinKs V1.329 requis ; bridge privé en lecture seule, aucune migration ou base PulSe.
- Images AMD64/ARM64 `ghcr.io/mick7784/links-pulse:1.1.4` et `:latest`, même digest vérifié. Tags numérotés non réécrits, anciennes exécutions refusées.
- PULSE_VERSION accepte 1.1.4 (défaut épinglé) ou latest (pull/recreate explicite).

Validation : suites Node, navigateur mobile/PWA, intégration réelle PulSe–LinKs–SQLite, tests Docker et frontière privée en CI. Captures 320/360/390/412/480 px. Pas de recette physique Samsung ; clavier et affichage standalone simulés.

L'intégration exécute l'image publiée LinKs V1.329, épinglée par digest dans `tests/links-release.json` (commit `8fbc2a5a2f1eee58f070c8f4cdc4a6a82819b560`). Les labels de version/révision, le digest téléchargé et le moteur `/app/analytics.py` exécuté sont vérifiés. Seuls les deux scripts de préparation des données de test sont montés ; aucun code applicatif de l'image n'est remplacé. SQLite et médias sont jetables, sans accès aux données de production.

HTTP Basic et secrets conservés. Aucun changement du VPS, Dockhand, Pangolin ou Traefik.

Retour arrière : lors d'un déploiement séparément autorisé, sélectionner `PULSE_VERSION=1.1.3` et pull/recreate PulSe, sans toucher aux volumes LinKs. LinKs V1.329 reste compatible avec PulSe v1.1.3.

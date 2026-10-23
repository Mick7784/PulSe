# PulSe V1.1.2 — installation PWA

Correctif de la V1.1.1, sans changement d'interface graphique.

- Métadonnées d'installation, icônes et service worker désormais accessibles sans authentification HTTP Basic ; dashboard, scripts et APIs restent protégés.
- Le manifeste est demandé avec les identifiants quand ils sont nécessaires.
- Service worker révisé : seul le contenu PWA public peut être mis en cache ; aucun HTML authentifié, lien privé, compteur, API ni média.
- Page hors-ligne neutre « réessayer » ; aucun contenu privé en cache.
- Test automatisé supplémentaire des autorisations HTTP et de l'API Chromium de manifeste/installabilité (navigateur de CI).
- Image GHCR `ghcr.io/mick7784/links-pulse:1.1.2`.

**Pré-requis** : HTTPS avec certificat valide sur le domaine public derrière Pangolin. Une authentification supplémentaire côté proxy peut toujours bloquer le navigateur : vérifier que les icônes et le manifeste renvoient HTTP 200 depuis le téléphone, sans demander d'identifiants.

**Limite** : le test Chromium desktop ne prouve pas la création d'un WebAPK sur Samsung Android. Une recette physique Chrome/Samsung Internet est requise. Le nouveau logo multicolore et la refonte PulSe V1.2 ne sont pas inclus.

**Déploiement** : garder le Compose et les secrets existants ; définir `PULSE_VERSION=1.1.2` dans l'environnement Dockhand puis redéployer seulement après validation. Rollback : `PULSE_VERSION=1.1.1`.

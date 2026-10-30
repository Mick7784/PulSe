# Phase 5 — Gestion des liens LinKs depuis PulSe

## Dépendance et périmètre

Base PulSe : `c67eebd`, branche `feat/pulse-refonte-mobile`. LinKs audité avant modification : main/tag publié **V1.327**, `079b2987df71ebd332745d80df423ed42674c042`. La branche dédiée `feat/pulse-link-management` ajoute le bridge au commit **1946186810d0636c3568ccfa295021897f00cf58**. La CI PulSe utilise ce commit exact, jamais une branche flottante.

La V1.327 publiée ne contient pas encore ce bridge de gestion. Tant que l'extension LinKs n'est pas disponible, l'onglet Liens affiche cette dépendance ; les Stories et statistiques conservent leurs routes existantes. Cette phase ne déploie et ne publie aucune image, ne fusionne aucune branche et ne change aucun paramètre Pangolin.

Au moment de l'audit, aucune PR ouverte ni fonction de génération automatique de titres ou de création par lot de liens suivis n'était visible dans les branches distantes et le code LinKs examinés. PulSe n'en implémente aucune. Une évolution ultérieure devra passer par le moteur commun. Les catégories supprimées en V1.327 ne sont pas réintroduites : YouTube, Instagram, Discord et les sources personnalisées viennent de `tracking_sources`.

## Parcours et garanties

Le nouvel onglet Liens reprend les couleurs, composants et navigation mobile existants. Saisir une URL et un nom obligatoire, choisir la détection automatique, un partenaire précis ou Aucun, puis examiner l'URL finale calculée par LinKs. L'enregistrement demande de cocher sa vérification. Un changement de destination affiche l'ancienne URL et exige une seconde confirmation explicite ; il affecte les liens courts déjà partagés.

L'aperçu est calculé par `affiliate_partners.preview_tracked`. LinKs signe un reçu limité à dix minutes, lié exactement aux champs, à l'URL attendue et à la révision du lien. À l'enregistrement, une transaction `BEGIN IMMEDIATE` recontrôle la révision, les règles partenaires, les doublons et la confirmation via `affiliate_partners.save_tracked`. Un renommage seul conserve la destination effective, même si un code partenaire a changé entre-temps. Aucun schéma ni stockage métier supplémentaire.

PulSe propose de réutiliser un doublon actif, sans le renommer ni modifier sa destination. Il ne permet pas de forcer la création d'un doublon. Les doublons désactivés ou archivés restent visibles comme indisponibles. Les conflits concurrents ou après une réponse perdue sont recontrôlés côté LinKs. Un conflit de modification exige de réactualiser puis rouvrir le lien ; la saisie reste affichée pour permettre sa récupération.

Choisir ensuite une plateforme/source et demander son lien court. `tracked_links.token_link` conserve l'identité et le jeton existants pour ce couple lien/source. Les anciennes sources historiques restent sélectionnables. Le changement de source efface immédiatement le résultat précédent. Une copie refusée propose la sélection manuelle puis une confirmation par l'utilisateur.

« URL finale » désigne la destination effective calculée et validée par le moteur LinKs, affichée intégralement et ouvrable pour vérification. Ce n'est pas une résolution réseau des redirections successives du marchand : aucun téléchargement arbitraire d'URL ni recherche de titre n'est ajouté.

## Sécurité et réseau

Le navigateur utilise uniquement quatre routes PulSe : `GET /api/link-manager` et `POST /api/link-preview`, `/api/link-save`, `/api/link-token`. Le serveur les traduit vers les quatre routes dédiées `/api/pulse/…`. HTTP Basic, contrôle d'origine, en-tête POST dédié et taille maximale 32 Kio restent imposés. Le Bearer ne quitte jamais les échanges serveur à serveur. Les réponses sont projetées sur les champs nécessaires ; les erreurs amont, modèles partenaires, jetons internes et sessions administratives ne sont pas relayés. Aucun proxy admin général.

Les préparations restent en mémoire pendant une erreur réseau, une navigation entre onglets PulSe ou une mise à jour en attente. Aucune écriture n'est rejouée automatiquement au retour du réseau. Fermer, recharger volontairement ou laisser Android détruire la page peut perdre une saisie non enregistrée : elle n'est pas stockée sur le téléphone. Une saisie modifiée ou une écriture en cours bloque l'application d'une mise à jour ; une activation dans un autre onglet ne la recharge pas. Les protections des Stories restent actives en parallèle.

API, formulaires, liens, médias et scripts authentifiés restent exclus du cache du service worker. Aucun localStorage, IndexedDB, base parallèle ni accès admin LinKs n'est ajouté. La configuration privée préparée en phase 4, y compris le refus externe de `/api/pulse/`, reste inchangée et doit toujours être validée sur le VPS avant activation réelle.

## Validation reproductible

- `node --test tests/*.test.mjs` : 14 tests, dont les nouvelles limites de routes, CSRF, refus d'accès, projections et erreurs sans secret.
- `NODE_PATH=<Playwright> node tests/browser.cjs` : régressions mobile/Stories et cycle réel du service worker (installation, mise à jour, plusieurs onglets, brouillons Story et lien, hors-ligne). Les données métier de cette suite sont des fixtures.
- `LINKS_REPO=<checkout LinKs 1946186> PYTHON_PATH=<python avec Pillow> NODE_PATH=<Playwright> node tests/links-integration.cjs` : véritable HTTP PulSe → HTTP LinKs → moteur commun → SQLite temporaire, piloté dans Chromium. Aucun remplacement simulé de LinKs. Les interceptions réseau ne servent qu'à provoquer pertes de réponse et désordre de réponses.
- Dans LinKs : `python scripts/pulse_manager_test.py`, puis la CI complète du dépôt (moteur existant, navigateur, conteneurs et AMD64/ARM64). Les 48 tests Python de cette commande comprennent les tests Analytics importés.

Le test réel couvre affiliation auto/manuelle/Aucun, création, renommage, destination confirmée, doublons et réutilisation, sources, jetons stables, anciens liens et clics, presse-papiers refusé, coupure/reconnexion, réponse perdue après commit, aperçus arrivant en désordre et largeurs 320/390/480 px. `CHROMIUM_PATH` permet Chrome local ; `PULSE_SCREENSHOT_DIR` exporte les captures. Toutes les données sont temporaires. Aucun test ne visite un marchand ou un lien de production.

## Recette Samsung et retour arrière

À réaliser physiquement après une autorisation de mise à disposition : répéter création/modification/copier dans Chrome et dans la PWA, avec clavier tactile, partenaires auto/manuels, source historique et source récente. Refuser le presse-papiers, annuler un abandon, changer d'onglet avec Story et formulaire en cours. Couper/reconnecter Pangolin, interrompre un enregistrement et vérifier qu'une reprise ne crée aucun doublon. Vérifier HTTPS, mise à jour avec deux onglets, arrière-plan puis retour dans la PWA. La validation Chromium ne constitue pas une validation Samsung.

En cas de retour arrière ultérieur, revenir au code/image PulSe précédent et au code/image LinKs précédent avec les mêmes variables, secrets et données. Aucun changement de schéma à annuler. Les liens créés restent des liens LinKs ordinaires : ne pas supprimer les liens ou tokens déjà partagés. Un retour de code ne restaure pas une destination modifiée volontairement ; la corriger explicitement dans LinKs si nécessaire. Ne pas retirer HTTP Basic ni les protections préparées en phase 4.

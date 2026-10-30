# Phase 8 — validation de la refonte mobile

Audit du 30 octobre 2026. Branche `feat/pulse-refonte-mobile`, ensemble des phases 2 à 7 puis correctif final du repère de préparation Liens. **Validation automatique réussie ; livraison et validation physique restent à autoriser.** Aucun déploiement, fusion, release, changement VPS ou retrait de HTTP Basic.

## Périmètre et dépendances

- Interface mobile et logo officiels, icônes Android/maskable, installation et mises à jour PWA explicites.
- Création, modification et partage des liens depuis le moteur LinKs ; partenaires, URL finale, confirmation de destination, doublons et tokens réutilisés. Aucune catégorie ni base parallèle.
- Campagnes éligibles, Stories avec médias locaux, retour depuis la création/réutilisation d'un lien sans effacer le média.
- Préparations textuelles YouTube/Discord et synthèse 7/30 jours. Le partage natif et la déclaration manuelle ne prouvent pas une publication et ne comptent pas comme clics.
- Configuration privée candidate de phase 4 inchangée. Bearer côté serveur, API administratives non exposées par PulSe, cache limité aux ressources publiques de la PWA.
- Correction finale : le repère existant de l'onglet Liens indique aussi un texte de publication en cours, y compris en changeant de vue, puis disparaît après déclaration. Testé dans le parcours réel ; marqueur de mise à jour `pwa8-1`.

LinKs requis : `dfc67c4f2c36464a7e4b27f0c41f4d7d54f44c16`, branche `feat/pulse-link-management`, épinglé dans la CI PulSe. Base validée V1.327 : `079b2987df71ebd332745d80df423ed42674c042`. La version V1.327 seule ne fournit pas les nouvelles routes. Les versions techniques et le Compose restent à `1.1.2` : **l'image publiée 1.1.2 ne contient pas cette refonte**. Choisir et publier la future version seulement après accord distinct.

## Preuves et limites des tests

| Vérification | Résultat / nature de la preuve |
| --- | --- |
| `node --test tests/*.test.mjs` | 16 tests réussis : projections, routes, Basic/CSRF, Bearer isolé, redirections refusées, erreurs sans secrets, métadonnées PWA, politique de refus public. |
| `node tests/browser.cjs` | Chrome réel, données de test : navigation, graphique, médias et erreurs, installation Chromium, cycle réel des service workers, refus d'accès, hors-ligne et reconnexion. |
| `node tests/links-integration.cjs` | Vrais serveurs HTTP PulSe et LinKs avec moteur commun et SQLite temporaire, pilotés par Chrome. Création/modification, partenaires, confirmations, doublons, réponse perdue après commit, réutilisation des tokens, liens historiques et clics réels de recette. |
| Suites Stories et multicanal incluses dans l'intégration | Campagnes au-delà de trois emplacements, éligibilité, visuels, photo/vidéo conservées, retour du formulaire, sources YouTube/Discord, texte et presse-papiers, limites de longueur, statistiques et erreurs réseau. |
| `python scripts/pulse_manager_test.py` dans LinKs | 49 tests réussis, comprenant les tests Analytics importés ; HTTP et SQLite réels, transactions, accès refusés, synthèse en lecture seule et conservation de l'historique. |
| Revue visuelle | Captures locales et contrôles 320/390/480 px, logo, formulaires, repères de brouillon, préparation Discord et statistiques. Aucun débordement horizontal détecté. Ne mesure pas la facilité d'usage ni le temps de saisie sur téléphone. |
| CI complète | PulSe ajoute construction/conteneur et vrai Traefik 3.6.1 ; LinKs vérifie aussi ses parcours existants et les images AMD64/ARM64. Les résultats des derniers commits/PR doivent être verts avant toute décision de livraison. Aucun Docker exécuté localement. |

Références antérieures au correctif final : [CI PulSe `3becc96`](https://github.com/Mick7784/PulSe/actions/runs/41089932458), [CI LinKs `dfc67c4`](https://github.com/Mick7784/LinKs/actions/runs/41088007644), toutes deux réussies. Les CI des PR finales complètent ces preuves ; leurs liens et résultats sont consignés dans les descriptions des PR.

Les appels natifs de copie/partage sont contrôlés par les tests navigateur. Aucune publication Instagram/YouTube/Discord réelle n'est effectuée. Le test Traefik utilise une cible LinKs de recette pour la frontière réseau ; il ne valide pas le VPN Pangolin réel. L'intégration métier utilise bien LinKs réel, séparément. Toutes les données sont temporaires ; aucun lien de production n'est visité.

## Travail LinKs parallèle

La PR [LinKs #53](https://github.com/Mick7784/LinKs/pull/53), instantané `00a0bc489f20fa52fe4df1724d50c84c708115c6`, contient les titres automatiques et la création par lot (étapes 1–4). Elle est ouverte, non fusionnée et absente du moteur testé ici. PulSe ne duplique pas ces fonctions et n'expose pas leurs routes admin.

Une comparaison `git merge-tree --write-tree` sans fusion de branches ni modification du checkout signale deux conflits additifs : `Dockerfile` (copies de modules) et `scripts/analytics.py` (imports). Une intégration ultérieure devra conserver `pulse_manager`, `url_inspection` et `tracked_batch`, puis relancer les tests des deux chantiers et l'intégration PulSe. La fusion textuelle des autres fichiers ne prouve pas leur compatibilité d'exécution. Refaire cette vérification si la PR #53 évolue ; aucune anticipation de ses étapes futures.

## Conditions restant à valider

1. **Pangolin/VPS** : versions/édition, type de site/connecteur, client Android, permissions et révocation, inventaire des routeurs/alias/ports IPv4/IPv6, refus public de PulSe et `/api/pulse/`, bridge interne, DNS, certificat HTTPS et renouvellement. Procédure en lecture seule puis recette conditionnelle dans [ACCES-PRIVE.md](ACCES-PRIVE.md). Aucun de ces paramètres n'est supposé acquis. HTTP Basic reste obligatoire.
2. **Samsung physique** : installation réelle et relance PWA, tunnel connecté/déconnecté/sans droit, Wi-Fi/mobile, clavier et durée de création d'un lien (objectif ≈ 30 secondes non mesuré), presse-papiers, partage des fichiers, codecs, sticker Instagram, destinataires YouTube/Discord, écran éteint/arrière-plan, coupure/reconnexion et mise à jour avec préparations ouvertes. Voir [RECETTE.md](RECETTE.md) et [LIENS-PHASE5.md](LIENS-PHASE5.md).
3. **Limite de conservation** : les préparations survivent aux erreurs réseau et aux changements de vue dans une page vivante. Elles restent en mémoire ; fermeture, rechargement manuel ou destruction du processus par Android peuvent les perdre. Aucun stockage persistant privé ajouté. Une réponse réseau perdue peut correspondre à un enregistrement LinKs effectué : reprise explicite, sans répétition automatique des écritures.
4. **Livraison** : garder les PR en brouillon jusqu'à décision explicite, valider la paire de commits LinKs/PulSe et les CI finales. Ne pas déclencher de workflow de release ni modifier `main`. Les workflows existants peuvent publier lors d'une future fusion sur `main` : vérifier leur comportement et la version choisie avant d'autoriser cette fusion. La release unique PulSe nécessite un accord distinct.

## Risques et retour arrière

Avant une future mise à disposition autorisée, conserver les images par digest, Compose, paramètres proxy/DNS et secrets dans un emplacement protégé ; terminer les préparations en cours. Revenir aux images et configurations réellement validées précédemment en conservant les mêmes données LinKs, liens, tokens et compteurs. Aucun schéma ni migration ajouté par le bridge de ce chantier. Un retour de code ne remet pas automatiquement une destination modifiée volontairement : la corriger explicitement dans LinKs si nécessaire.

Pour l'accès privé, préférer une indisponibilité temporaire avec Basic et refus public conservés à une réouverture automatique d'Internet. Restaurer seulement les règles ajoutées et la cible interne concernée ; ne pas toucher aux routes publiques, volumes ou données LinKs. Vérifier ensuite les anciens liens et le bridge. Le détail du retour arrière réseau reste dans la recette de phase 4.

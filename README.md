# PulSe V1.1.2

Application mobile de préparation de Stories et de consultation des clics LinKs. Docker indépendant ; aucune commande de déploiement automatique. Base V1 récupérée intégralement depuis le Compose Dockhand fourni par le propriétaire, puis versionnée sur une branche distincte.

## Interface

- En-tête : logo officiel PulSe, recadré à partir du fichier fourni sans modification des formes ou proportions. Les icônes PWA 192/512 utilisent l’image originale complète, sans découpe ni déformation ; les variantes `maskable` gardent toute l’image dans le cercle de sécurité central.
- Interface exclusivement mobile (320–480 px), surfaces et hiérarchie LinKs, accents cyan/violet/rose. Navigation basse Statistiques / Stories ; le brouillon et la position de lecture sont conservés lors du changement de vue, dans la page en cours.
- Dernière vidéo YouTube de la source LinKs existante : titre, miniature, préparation d’un lien court propre à cette vidéo et d’une image verticale 1080 × 1920 avec fond flou.
- Offres actives : petite image et titre ; liens privés suivis : maillon, nom et recherche sur toute la liste fournie. Liens classiques exclus.
- L’éditeur apparaît immédiatement sous le contenu choisi. Photo/vidéo du téléphone possible pour ce contenu ; aucun bloc « Photo personnelle » séparé. Les photos restent locales, les images sont préparées en JPEG 1080 × 1920 sans recadrer leur contenu ; les vidéos sont partagées dans leur format original (sans promesse de conversion ou de compatibilité Instagram).
- Statistiques 7/30 jours : clics du jour, total de période, clics Story inclus dans ce total, graphique daté/chiffré et tableau accessible. Pas de « Stories déclarées », pas de métrique « Offres actives » dupliquée. Pas de top publications : attribution par publication non démontrée.
- Installation PWA : invite navigateur quand disponible, instructions Safari/iOS ou Android sinon, état installé en mode autonome et sur événement `appinstalled`. Une installation antérieure ne peut pas être détectée universellement depuis tous les onglets et navigateurs.

## Mises à jour PWA

Le nouveau service worker attend une validation dans la notification « Mise à jour disponible ». Le rechargement est bloqué tant qu’une Story est en préparation, y compris si elle démarre pendant l’activation ; « Plus tard » conserve la page ouverte. Une validation dans un autre onglet ne recharge jamais celui qui contient une préparation. Après la confirmation manuelle de publication, la mise à jour peut être acceptée. Les préparations restent uniquement en mémoire : aucune sauvegarde persistante de média, lien ou donnée privée n’est ajoutée ; fermer l’application ou recharger manuellement peut toujours les perdre.

Seuls le manifeste, les icônes et la page hors connexion avec sa feuille de style sont précachés, depuis une liste fixe et sans identifiants. Le téléchargement valide statut et type de contenu, refuse les redirections et expire après 15 secondes. Un échec laisse l’ancienne version active. Les caches PulSe précédents sont supprimés à l’activation, sans toucher aux autres caches. Incrémenter `VERSION` dans `sw.js` à chaque changement de ces ressources publiques. La recherche de mise à jour ignore le cache HTTP et reprend au retour en ligne/au premier plan, puis chaque heure visible.

La recette navigateur couvre les vraies transitions du service worker, un échec d’installation, deux onglets avec photos/vidéos, la confirmation de rechargement, une préparation démarrée pendant l’activation, les zones `maskable`, le nettoyage et l’exclusion des données privées du cache, ainsi que la navigation hors connexion. Elle ne remplace pas l’installation physique sur Samsung derrière Pangolin.

## Parcours de publication

Touchez « Préparer et publier la Story » sur la vidéo (ou choisissez une offre/un lien). Un parcours en quatre étapes s’ouvre directement sous le contenu :

1. **Préparer le visuel** : miniature transformée en JPEG Story 1080 × 1920 avec fond flou, ou média local du téléphone.
2. **Copier le lien suivi** : bouton de copie ; si le navigateur refuse, sélection du texte et confirmation de copie manuelle. Le partage s’active après cette étape.
3. **Partager le média** : fichier seul remis au partage système, ou enregistrement/import depuis la galerie. L’annulation conserve le brouillon.
4. **Publier dans Instagram** : ajouter manuellement le sticker Lien, coller l’URL, publier, puis revenir et confirmer avoir effectué ces actions. La fin du parcours est une déclaration manuelle en mémoire, pas une preuve Instagram et pas un compteur dans les statistiques.

La préparation du visuel est indépendante de celle du lien. Si LinKs est trop ancien, le visuel reste disponible et un message indique que la liaison doit être mise à jour, avec un bouton de nouvelle tentative. Le partage suivi et la fin du parcours restent bloqués tant que le lien n’est pas prêt/copié. L’authentification et les erreurs de vidéo devenue ancienne sont également distinguées.

## Charte graphique et graphique mobile

La référence visuelle fournie est appliquée aux surfaces navy/noir, contours cyan lumineux, cartes en dégradé et boutons bleu électrique. Ses anciens logo graphique et badge de version ne sont pas repris : le mot PulSe reste seul dans l’en-tête et la version au footer.

Les valeurs de l’histogramme sont blanches, contrastées et rendues à **15 pixels réels minimum** dans la recette mobile (pas réduites par une grande vue SVG). La période 30 jours se parcourt horizontalement ; toucher une barre ou la parcourir au clavier affiche son jour et sa valeur en texte. Le tableau accessible reste disponible. Aucune donnée de démonstration n’est injectée dans l’application.

## Prérequis LinKs

**Phase 5 (branche de développement uniquement)** : création, modification et partage depuis l'onglet Liens, via le moteur commun LinKs. Cette fonctionnalité nécessite l'extension dédiée de LinKs au-delà de V1.327 ; voir [le contrat, les tests réels, les limites et le retour arrière](docs/LIENS-PHASE5.md). Aucune release ni mise en production n'est réalisée dans cette phase.

LinKs V1.315 possède la passerelle privée de base. LinKs V1.316 ajoute `GET /api/pulse/stats?days=7|30` et le type `youtube` de `POST /api/pulse/story-link`. **La préparation YouTube et les statistiques sur 30 jours nécessitent LinKs V1.316 effectivement déployée.** PulSe reste explicite si elle est absente et ne fabrique pas de données ou de lien non suivi.

Les métadonnées proviennent de `/latest-video.json` de LinKs ; aucune deuxième clé YouTube ni connexion Meta n’est ajoutée. À la préparation explicite d’une vidéo, LinKs crée/réutilise un lien privé avec destination fixée à cette vidéo et source Instagram Story. Les catégories ont été supprimées dans LinKs V1.327. Les jetons des anciennes offres et des anciens liens restent réutilisés. Ce suivi est par contenu/source, pas par publication Instagram.

## Variables et déploiement, après validation uniquement

Conserver les valeurs existantes dans Dockhand, jamais dans Git :

```dotenv
PULSE_VERSION=1.1.2
PANGOLIN_PROXY_NETWORK=pangolin
PULSE_TEST_USER=
PULSE_TEST_PASSWORD=
PULSE_BRIDGE_TOKEN=
```

`PULSE_TEST_USER` et `PULSE_TEST_PASSWORD` sont obligatoires (mot de passe existant de 12 caractères minimum). `PULSE_BRIDGE_TOKEN` doit être identique au secret du conteneur LinKs, 32 caractères minimum ; vide signifie passerelle non connectée. Ne pas transmettre ces valeurs par conversation. Valeurs par défaut : `LINKS_PUBLIC_URL=http://domotik-links:8080`, `LINKS_BRIDGE_URL` reprend cette URL, port 4173.

Le Compose conserve `name: links-pulse-test`, l’alias `pulse-story-spike-test`, le réseau externe `pangolin`, le port lié à 127.0.0.1 et `/healthz`. Pangolin termine HTTPS et conserve sa cible `http://pulse-story-spike-test:4173` ; ne pas modifier LinKs, son volume ou ses ressources réseau pour déployer PulSe. Le service et le nom de stack existants doivent rester identiques pour éviter deux conteneurs utilisant le même alias.

`compose.yaml` utilise désormais l’image publique versionnée `ghcr.io/mick7784/links-pulse:${PULSE_VERSION:-1.1.2}`, sans contexte Git ni compilation locale. `pull_policy: always` télécharge l’image lors d’un redéploiement. Le vrai `.env` de Dockhand doit contenir `PULSE_VERSION=1.1.1` ainsi que les secrets préexistants ; `.env.example` n’est qu’un modèle et ne contient aucun secret.

Avant toute mise à jour : conserver le Compose et l’image V1, les variables, la cible Pangolin et la possibilité de reconstruire/revenir à la V1. LinKs V1.316 est publiée : s’assurer qu’elle est aussi *déployée* avant de tester les liens YouTube suivis et les statistiques 30 jours. Une fusion de PR ne déploie jamais PulSe. Depuis la V1.1.1, le pipeline de release publie une image GHCR versionnée depuis `main` après validation ; le déploiement reste manuel dans Dockhand.

## Sécurité et comportement dégradé

La phase 4 prépare l'accès privé Pangolin sans l'activer : [audit, configuration candidate, vérifications VPS, recette Samsung et retour arrière](docs/ACCES-PRIVE.md). HTTP Basic reste obligatoire. Le Compose de production existant n'est pas modifié ; le modèle privé séparé retire les ports hôte, et un générateur prépare le refus public PulSe et `/api/pulse/` de LinKs après inventaire des routes réelles. Aucun paramètre du VPS n'est présumé validé.

Une coupure de connexion dans une page ouverte conserve la Story en mémoire. Les requêtes de catalogue, statistiques et génération de lien expirent après 12 secondes, affichent une erreur de connexion ou d'accès et ne sont jamais rejoués automatiquement ; le bouton de réessai existant reste disponible. Fermer ou recharger la page peut toujours perdre le brouillon.

Le navigateur n’obtient jamais le Bearer LinKs. Basic Auth PulSe reste obligatoire hors développement local. Aucun proxy admin générique. Le proxy média n’accepte que des IDs de catalogue, des images `/uploads/` ou `/assets/` autorisées, et des miniatures YouTube HTTPS du domaine `i.ytimg.com` correspondant à la vidéo. Redirections amont refusées, taille et durée limitées. POST JSON avec contrôle d’origine et en-tête dédié. Les API, liens suivis et médias ne sont jamais mis en cache par le service worker ; les photos/vidéos ne sont jamais téléversées.

En cas de statistiques incomplètes, de période incompatible ou d’erreur : valeurs « — » et graphique retiré, sans conserver de chiffres périmés sous la nouvelle période. Les liens suivis ne sont pas remplacés par des URL partenaires si la passerelle échoue. Les visuels `system:` non rendus par LinKs peuvent être remplacés par un média choisi sur le téléphone.

## Tests

`node --test tests/*.test.mjs` : catalogue, authentification, restrictions du proxy, contrats 7/30 jours et vidéo, absence de repli non suivi, instructions PWA. Aucun paquet de production requis.

`NODE_PATH=<dossier node_modules contenant playwright> node tests/browser.cjs` : parcours mobile de 320 à 480 px avec serveurs et données de test locaux, conservation du brouillon entre les vues, photo/vidéo, erreurs, partage, copie et installation. Un profil navigateur isolé permet les contrôles d’installation sans le mode privé. `CHROMIUM_PATH` facultatif pour utiliser un Chrome installé ; `PULSE_SCREENSHOT_DIR` choisit le dossier des captures. La CI installe le navigateur de test et construit/vérifie une image Docker isolée. Sur `main`, après validation, elle publie sur GHCR et crée une release GitHub si cette version n’existe pas déjà ; aucun déploiement VPS n’est exécuté.

Voir [la recette physique](docs/RECETTE.md) et [les changements](docs/V1.1.md). Un test de navigateur simulant Web Share ne prouve ni l’ouverture effective de Story ni la publication sur Samsung.


## Mise à jour par image GHCR

Le Compose conserve le nom de projet `links-pulse-test`, l'alias Pangolin `pulse-story-spike-test`, le réseau externe et les restrictions du conteneur. Il ne contient plus de `build:` local. Pour mettre à jour PulSe dans Dockhand :

1. Sauvegarder le Compose, les valeurs de l'environnement et l'image actuelle (pour retour arrière). Ne pas copier les secrets dans Git.
2. Remplacer le Compose de la stack existante par `compose.yaml` de la branche `main` ; ajouter `PULSE_VERSION=1.1.1` au `.env` réel de la stack, sans modifier les autres variables.
3. Redéployer **la stack existante** ; ne pas créer un deuxième service sur le même alias. Docker récupère l'image versionnée depuis GHCR. Vérifier le healthcheck et la cible Pangolin.
4. En cas de problème, remettre l'ancien Compose et l'ancienne image. Pour les futures versions, changer `PULSE_VERSION` vers un tag *publié* puis redéployer.

Si GHCR refuse un téléchargement anonyme, vérifier la visibilité publique du package GitHub ou configurer l'authentification du registre dans Dockhand. Le tag ne dépend pas de `latest`.


## Correctif PWA V1.1.2

Le manifeste, les icônes, la page hors-ligne et le service worker sont accessibles sans Basic Auth, afin que Chrome Android puisse récupérer les métadonnées d'installation (le manifeste HTML indique également `crossorigin="use-credentials"`). Les pages d'application, scripts et APIs continuent d'exiger l'authentification. Le service worker ne met **jamais** en cache le tableau de bord authentifié, les liens, les images personnelles ou les API.

La CI vérifie le manifeste via l'API Chromium et le service worker, mais le statut « application installée » ne peut être confirmé qu'après un test sur le vrai Samsung, depuis l'URL HTTPS Pangolin et hors navigateur intégré à une autre application. Si Chrome n'offre que « raccourci », vérifier le certificat HTTPS, l'accès public HTTP 200 au manifeste/icônes et les éventuelles protections supplémentaires du proxy.

Pour utiliser cette image depuis Dockhand : `PULSE_VERSION=1.1.2`, puis redéployer la stack existante. Pour revenir en arrière : `PULSE_VERSION=1.1.1`. La charte graphique V1.2 reste un chantier distinct.

# PulSe V1.1.1

Application mobile de préparation de Stories et de consultation des clics LinKs. Docker indépendant ; aucune commande de déploiement automatique. Base V1 récupérée intégralement depuis le Compose Dockhand fourni par le propriétaire, puis versionnée sur une branche distincte.

## Interface

- En-tête : **PulSe en texte uniquement**. Pas de symbole de marque ni de badge de version. Les icônes d’installation reprennent uniquement ce même texte. Version au footer.
- Interface bleu/navy responsive ; accordéon « Préparer une Story » fermé par défaut, statistiques visibles dessous.
- Dernière vidéo YouTube de la source LinKs existante : titre, miniature, préparation d’un lien court propre à cette vidéo et d’une image verticale 1080 × 1920 avec fond flou.
- Offres actives : petite image et titre ; liens privés suivis : maillon, nom, catégorie, recherche sur toute la liste fournie. Liens classiques exclus.
- L’éditeur apparaît immédiatement sous le contenu choisi. Photo/vidéo du téléphone possible pour ce contenu ; aucun bloc « Photo personnelle » séparé. Les photos restent locales, les images sont préparées en JPEG 1080 × 1920 sans recadrer leur contenu ; les vidéos sont partagées dans leur format original (sans promesse de conversion ou de compatibilité Instagram).
- Statistiques 7/30 jours : clics du jour, total de période, clics Story inclus dans ce total, graphique daté/chiffré et tableau accessible. Pas de « Stories déclarées », pas de métrique « Offres actives » dupliquée. Pas de top publications : attribution par publication non démontrée.
- Installation PWA : invite navigateur quand disponible, instructions Safari/iOS ou Android sinon, état installé en mode autonome et sur événement `appinstalled`. Une installation antérieure ne peut pas être détectée universellement depuis tous les onglets et navigateurs.

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

LinKs V1.315 possède la passerelle privée de base. La PR séparée `feat/pulse-v1.1-stats` ajoute `GET /api/pulse/stats?days=7|30` et le type `youtube` de `POST /api/pulse/story-link`. **La préparation YouTube et les statistiques sur 30 jours nécessitent cette extension validée et publiée séparément.** PulSe reste explicite si elle est absente et ne fabrique pas de données ou de lien non suivi.

Les métadonnées proviennent de `/latest-video.json` de LinKs ; aucune deuxième clé YouTube ni connexion Meta n’est ajoutée. À la préparation explicite d’une vidéo, LinKs crée/réutilise un lien privé avec destination fixée à cette vidéo, catégorie YouTube et source Instagram Story. Les jetons des anciennes offres et des anciens liens restent réutilisés. Ce suivi est par contenu/source, pas par publication Instagram.

## Variables et déploiement, après validation uniquement

Conserver les valeurs existantes dans Dockhand, jamais dans Git :

```dotenv
PANGOLIN_PROXY_NETWORK=pangolin
PULSE_TEST_USER=
PULSE_TEST_PASSWORD=
PULSE_BRIDGE_TOKEN=
```

`PULSE_TEST_USER` et `PULSE_TEST_PASSWORD` sont obligatoires (mot de passe existant de 12 caractères minimum). `PULSE_BRIDGE_TOKEN` doit être identique au secret du conteneur LinKs, 32 caractères minimum ; vide signifie passerelle non connectée. Ne pas transmettre ces valeurs par conversation. Valeurs par défaut : `LINKS_PUBLIC_URL=http://domotik-links:8080`, `LINKS_BRIDGE_URL` reprend cette URL, port 4173.

Le Compose conserve `name: links-pulse-test`, l’alias `pulse-story-spike-test`, le réseau externe `pangolin`, le port lié à 127.0.0.1 et `/healthz`. Pangolin termine HTTPS et conserve sa cible `http://pulse-story-spike-test:4173` ; ne pas modifier LinKs, son volume ou ses ressources réseau pour déployer PulSe. Le service et le nom de stack existants doivent rester identiques pour éviter deux conteneurs utilisant le même alias.

`compose.yaml` s’utilise depuis une copie Git de ce dépôt (contexte de build local). Pour une stack Dockhand basée uniquement sur du texte, un Compose autonome `dockerfile_inline` est livré dans l’archive de livraison ; il contient exactement les sources de cette version, sans secret. Ne pas coller le Compose avec `build: .` dans une stack vide sans source Git.

Avant toute mise à jour : conserver le Compose et l’image V1, les variables, la cible Pangolin et la possibilité de reconstruire/revenir à la V1. Publier et déployer l’extension LinKs uniquement après sa validation, puis tester PulSe sur un environnement distinct. Aucune fusion de PR ne déploie PulSe : sa CI ne publie aucune image.

## Sécurité et comportement dégradé

Le navigateur n’obtient jamais le Bearer LinKs. Basic Auth PulSe reste obligatoire hors développement local. Aucun proxy admin générique. Le proxy média n’accepte que des IDs de catalogue, des images `/uploads/` ou `/assets/` autorisées, et des miniatures YouTube HTTPS du domaine `i.ytimg.com` correspondant à la vidéo. Redirections amont refusées, taille et durée limitées. POST JSON avec contrôle d’origine et en-tête dédié. Les API, liens suivis et médias ne sont jamais mis en cache par le service worker ; les photos/vidéos ne sont jamais téléversées.

En cas de statistiques incomplètes, de période incompatible ou d’erreur : valeurs « — » et graphique retiré, sans conserver de chiffres périmés sous la nouvelle période. Les liens suivis ne sont pas remplacés par des URL partenaires si la passerelle échoue. Les visuels `system:` non rendus par LinKs peuvent être remplacés par un média choisi sur le téléphone.

## Tests

`node --test tests/*.test.mjs` : catalogue, authentification, restrictions du proxy, contrats 7/30 jours et vidéo, absence de repli non suivi, instructions PWA. Aucun paquet de production requis.

`NODE_PATH=<dossier node_modules contenant playwright> node tests/browser.cjs` : parcours mobile/desktop avec serveurs et données de test locaux. `CHROMIUM_PATH` facultatif pour utiliser un Chrome installé ; `PULSE_SCREENSHOT_DIR` choisit le dossier des captures. La CI installe le navigateur de test et construit/vérifie l’image Docker isolée, sans publication.

Voir [la recette physique](docs/RECETTE.md) et [les changements](docs/V1.1.md). Un test de navigateur simulant Web Share ne prouve ni l’ouverture effective de Story ni la publication sur Samsung.

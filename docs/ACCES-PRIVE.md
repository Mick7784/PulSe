# Phase 4 — accès privé PulSe : préparation, pas déploiement

Audit correctif du 31 octobre 2026, base release v1.1.4. **Isolation réelle non validée : aucune publication ni installation de v1.1.5.** Aucun accès ni changement au VPS, Pangolin, Dockhand, DNS, pare-feu ou LinKs. Le candidat n’a aucune authentification utilisateur intégrée ; sa protection d’accès dépend de la frontière privée.

## Architecture constatée dans les sources

| Flux | Constat | Limite de preuve |
| --- | --- | --- |
| Internet → Pangolin/Traefik → PulSe | La documentation v1.1.4 citait `pulse-test.domotik-studio.fr` → `http://pulse-story-spike-test:4173`, avec port loopback et réseau proxy partagé. Le candidat retire ces ports/alias ; les anciennes routes doivent être inventoriées et fermées. | L’état réel du VPS n’est pas connu. Le nom d’un réseau d’exemple n’est pas un inventaire. |
| Navigateur → PulSe | Toutes les routes sont servies sans connexion intégrée. | Toutes les routes, healthcheck et métadonnées inclus, exigent une frontière privée réelle. |
| PulSe → LinKs | Appels publics vers `/api/public-config`, `/latest-video.json`, visuels autorisés ; appels privés vers `/api/pulse/{links,stats,story-link}`. Origine interne par défaut `http://domotik-links:8080`. | DNS Docker, réseau partagé, image/version réellement déployés et valeurs d'environnement à vérifier. |
| Internet → LinKs | `nginx.conf` route aussi `/api/pulse/` vers l'application interne. Le bridge impose son Bearer ; les liens courts et la page publique ont d'autres routes. | Un proxy public vers ce Nginx peut donc exposer le chemin du bridge. Le Bearer protège les données, mais ne rend pas le chemin privé. |

Référence LinKs lue, sans modification : [release V1.329 `8fbc2a5a`](https://github.com/Mick7784/LinKs/tree/8fbc2a5a2f1eee58f070c8f4cdc4a6a82819b560), [Nginx](https://github.com/Mick7784/LinKs/blob/8fbc2a5a2f1eee58f070c8f4cdc4a6a82819b560/nginx.conf), [contrat du bridge](https://github.com/Mick7784/LinKs/blob/8fbc2a5a2f1eee58f070c8f4cdc4a6a82819b560/docs/PULSE-BRIDGE.md). Le Compose générique LinKs n'inventorie pas le réseau personnalisé du VPS ; il ne faut pas le substituer à celui de Dockhand.

## Faisabilité Pangolin / Android

La documentation officielle actuelle décrit un client Android utilisable avec une instance auto-hébergée. Les ressources privées demandent un **Pangolin Site avec connecteur compatible** et des autorisations explicites. Un **Local Site** ou un site WireGuard basique ne suffit pas. La présence d'un reverse proxy Pangolin sur le VPS ne prouve donc pas que l'accès privé est disponible. Vérifier version, édition, type de site, version du connecteur et fonctions réellement proposées avant toute décision. Ne pas mettre Pangolin à jour pendant cette phase. [Ressources](https://docs.pangolin.net/manage/resources/understanding-resources), [Android](https://docs.pangolin.net/manage/clients/platforms/android).

Chemin cible, si pris en charge : Samsung → client Pangolin connecté et autorisé → ressource **HTTPS privée** → terminaison TLS sur le site → `http://pulse-private:4173` → PulSe → LinKs interne. Donner accès à cette seule ressource ; ne pas ouvrir tout le sous-réseau Docker, LinKs admin, Docker socket ou un accès TCP public.

Le HTTPS privé Pangolin utilise un véritable domaine configuré dans l'organisation, résolu par le client connecté, et un certificat distribué au connecteur. Un alias interne et du HTTP seuls ne suffisent pas à une PWA Android sécurisée. Si l'instance ne propose que des ressources privées Host/IP, il faudra d'abord préparer séparément une terminaison HTTPS privée compatible ; ne pas annoncer cette solution comme disponible. [HTTPS privé](https://docs.pangolin.net/manage/resources/private/private-http).

## Configuration candidate livrée

Ces fichiers sont inertes tant qu'un opérateur ne les applique pas. Ils ne constituent pas une preuve d'isolation de la production.

### PulSe sans port hôte

`security/compose.private.yaml` est un **Compose autonome**, jamais à fusionner avec `compose.yaml` : une fusion pourrait conserver des ports ou réseaux de l'ancien fichier. Il conserve la stack, les restrictions et le bridge ; aucun port hôte ni ancien alias public. Il exige explicitement :

- une version PulSe effectivement validée et publiée, pas le numéro candidat avant publication ;
- le secret bridge existant ;
- les origines internes LinKs et bridge vérifiées, sans retour par le domaine public ;
- le réseau du connecteur privé et le réseau existant permettant de joindre LinKs.

L'alias candidat `pulse-private` est créé par ce fichier ; la cible privée devra correspondre. Aucun connecteur, réseau externe ou conteneur LinKs n'est créé/modifié par ce modèle. Les réseaux doivent exister et être distincts avec des membres vérifiés. Le réseau LinKs peut aujourd'hui être partagé avec Traefik : cela préserve le bridge mais ne crée pas une isolation réseau forte entre tous les conteneurs. `traefik.enable=false` empêche la découverte Docker automatique, **pas** un routeur Pangolin ou file-provider existant. Il faut retirer les anciennes ressources/targets publics et appliquer le refus en bordure. Un administrateur ou conteneur déjà autorisé sur le réseau reste dans la frontière de confiance.

### Refus sur Traefik public, sans toucher à LinKs

`security/edge-policy.mjs` produit un fragment dynamique Traefik à partir d'un inventaire explicite : JSON compatible YAML, avec extension `.yaml` pour le file-provider. `security/edge-input.example.json` est volontairement vide : le générateur refuse de deviner les domaines ou les entrées. Dans une copie de travail, renseigner :

```json
{
  "pulseHosts": ["pulse.example.test", "ancien-pulse.example.test"],
  "linksHosts": ["links.example.test"],
  "publicEntryPoints": [
    {"name": "NOM_HTTP_VERIFIE", "tls": false},
    {"name": "NOM_HTTPS_VERIFIE", "tls": true}
  ]
}
```

Les noms ci-dessus sont des exemples, pas les paramètres du VPS. Puis, **localement uniquement** :

```sh
node security/edge-policy.mjs inventaire.json refus-public.candidate.yaml
```

Le générateur refuse les paramètres absents, les injections de règles, les hôtes partagés PulSe/LinKs et l'écrasement d'un fichier. La politique :

- refuse **tous** les chemins des hôtes PulSe sur les seules entrées publiques inventoriées, sans aucune exception ;
- refuse `/api/pulse` et ses sous-chemins sur les hôtes LinKs, quelle que soit la méthode et même avec un Bearer correct ;
- laisse inchangés `/`, les liens courts à neuf caractères, `/go/`, les assets, uploads et API publiques LinKs ;
- ne cible aucun backend pour le refus (`noop@internal`, HTTP 418, `Cache-Control: no-store`). Le 418 est ici un refus intentionnel, pas une erreur du bridge. [Implémentation Traefik](https://github.com/traefik/traefik/blob/v3.6.1/pkg/server/service/internalhandler.go).

Priorité explicite `1000000000`, à comparer à **tous** les routeurs effectifs sur le VPS. Recette avec Traefik `3.6.1`, pas certification d'une autre version. Vérifier règles/normalisation des chemins, routage TCP/TLS passthrough (prioritaire sur HTTP), redirections d'entrée et ports alternatifs. Un HTTP redirigé vers HTTPS est acceptable uniquement si HTTPS refuse ensuite sans joindre PulSe/bridge. Désactiver l'ancienne ressource publique PulSe et ses alias, même si le garde-fou prioritaire les masque. Ne pas modifier directement les fichiers générés par Pangolin ; identifier un emplacement file-provider persistant distinct, sans écraser les autres règles. Ne pas activer d'API/dashboard Traefik public pour ce travail.

La liste des hôtes doit couvrir tous les alias. Les accès directs IP, règles catch-all, autres proxies/ports et IPv6 sont à auditer séparément : une politique limitée aux hôtes ne les ferme pas automatiquement. Pas de liste blanche fondée sur `X-Forwarded-For`, ni d'exception IP globale qui rouvrirait le bridge. L'appel interne PulSe → LinKs contourne la bordure publique et conserve son Bearer.

La recette a mis en évidence une différence de normalisation : Traefik peut conserver `%2f` dans le chemin utilisé pour les règles, alors que Nginx le décode en `/`. Le refus couvre explicitement ces deux formes, y compris à la racine et après `pulse`. Le serveur de recette reproduit le décodage du second serveur pour éviter qu'un simple 404 de fixture masque un contournement.

## Vérifications VPS en lecture seule, à faire avant activation

Ne pas envoyer `.env`, dump de base Pangolin, clés privées, cookies ou sortie intégrale de `docker inspect`. Les commandes ci-dessous ne déploient rien. Définir les variables indiquées à partir des vrais noms, jamais d'un exemple.

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker network ls
ss -lntup
```

Pour chaque conteneur Pangolin/Gerbil/Traefik/connecteur/PulSe/LinKs identifié :

```sh
: "${CONTAINER:?Nom de conteneur vérifié requis}"
docker inspect --format '{{.Config.Image}} {{.Image}}' "$CONTAINER"
docker inspect --format '{{json .HostConfig.PortBindings}}' "$CONTAINER"
docker inspect --format '{{range $name, $net := .NetworkSettings.Networks}}{{$name}} {{$net.IPAddress}} {{json $net.Aliases}}{{println}}{{end}}' "$CONTAINER"
docker inspect --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' "$CONTAINER"
```

Dans les fichiers repérés et le tableau de bord existant, relever sans exposer les secrets :

| Point | Preuve attendue |
| --- | --- |
| Versions / édition | Tags et digests réels, version Pangolin, client Android et connecteur ; fonctions privées HTTPS disponibles sur cette combinaison. |
| Site / tunnel | Type de site, connecteur en ligne, DNS Docker de la cible accessible depuis son espace réseau. Un connecteur en conteneur ne voit pas le `127.0.0.1` de l'hôte. |
| Autorisations | Utilisateur/role minimal autorisé, second utilisateur sans droit refusé, éventuelle approbation d'appareil ; aucun grant CIDR trop large. |
| Traefik | Tous les entrypoints, routers HTTP/TCP, hosts/aliases, priorités, cibles, providers et fichiers montés ; pas de chemin de contournement vers 4173, 8080 ou 8081. |
| Réseau | Interfaces IPv4/IPv6, pare-feu VPS et hébergeur, règles Docker/NAT. Ports de tunnel conformes à la version/configuration réelle ; les ports 51820/21820 cités par la documentation sont des défauts, pas des paramètres acquis. |
| Secrets | Même Bearer côté PulSe et LinKs, fichiers de secrets lisibles seulement par les administrateurs ; logs sans Authorization/Cookie/corps privés. |
| LinKs | Domaine public, pages et anciennes redirections toujours fonctionnels ; aucun changement de volume, token historique, image ou bridge. |

[Ports et DNS Pangolin](https://docs.pangolin.net/self-host/dns-and-networking).

Tester le bridge depuis le conteneur PulSe existant, sans afficher secret ni données, seulement un statut et un booléen :

```sh
: "${PULSE_CONTAINER:?Conteneur PulSe vérifié requis}"
docker exec "$PULSE_CONTAINER" node --input-type=module -e '
const base=process.env.LINKS_BRIDGE_URL||process.env.LINKS_PUBLIC_URL;
const token=process.env.PULSE_BRIDGE_TOKEN;
if(!base||!token)throw Error("Configuration bridge absente");
const r=await fetch(new URL("/api/pulse/stats?days=7",base),{
 headers:{Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(6000)
});
console.log({status:r.status,json:r.headers.get("content-type")?.includes("application/json")});
if(r.status!==200)process.exitCode=1;
'
```

DNS / certificat, avec et sans tunnel, sur les hôtes réels :

```sh
: "${PULSE_FQDN:?FQDN réel requis}"
dig +short A "$PULSE_FQDN"
dig +short AAAA "$PULSE_FQDN"
openssl s_client -connect "${PULSE_FQDN}:443" -servername "$PULSE_FQDN" -verify_hostname "$PULSE_FQDN" -verify_return_error </dev/null
curl --max-time 10 -sS -o /dev/null -w '%{http_code}\n' "https://${PULSE_FQDN}/"
```

Vérifier SAN, chaîne de confiance, expiration et renouvellement automatique. Ne jamais contourner TLS avec `-k` sur le vrai site. Si un certificat nécessite DNS-01, limiter les droits du jeton DNS et vérifier le mécanisme disponible ; ne pas supposer qu'une ressource HTTP privée peut obtenir son certificat par un challenge HTTP public après fermeture. Un simple retrait DNS ne ferme pas un accès par IP/Host ; tester aussi l'IP publique avec SNI/Host via `curl --resolve`, IPv4 et IPv6, après inventaire. Un nom existant peut continuer à résoudre via un wildcard public sans donner accès : le refus réseau/routage doit rester effectif.

## Recette à exécuter après une future autorisation d'activation

| Situation | Attendu |
| --- | --- |
| Internet sans VPN | PulSe ne sert ni app, API, healthcheck ni métadonnées PWA. Refus/absence de route, aucun contenu PulSe. |
| VPN connecté, utilisateur sans droit | Aucun accès à la ressource. Être connecté ne suffit pas. |
| VPN autorisé | Statistiques, catalogue, photo/vidéo, copie, partage et préparation du lien fonctionnent. |
| LinKs public `/api/pulse` avec/sans token | Refus en bordure sans appel bridge. Tester encodage, doubles slashs, tous les alias et ports publics ; ne pas envoyer le vrai secret vers une destination non vérifiée. |
| PulSe interne → bridge | 200 sur stats/links et lien suivi préparé sur demande, sans passer par le proxy public. |
| LinKs public hors bridge | Page, assets et redirections inchangés. Sur les vrais liens, un GET compte un clic : préférer HEAD pour l'audit des liens historiques, ou utiliser un lien de recette autorisé. |

### Samsung physique — aucune case validée à distance

1. Relever modèle, Android, navigateur, versions Pangolin/serveur ; ouvrir la bonne URL HTTPS dans Chrome et vérifier absence d'alerte certificat, contexte sécurisé, installation puis relance autonome.
2. En réseau mobile puis Wi-Fi, tester VPN déconnecté, connecté sans droit, connecté autorisé et droits révoqués/rétablis. Confirmer qu'aucun VPN concurrent, DNS privé Android ou option de batterie ne modifie le résultat. Vérifier aussi le renouvellement de session Pangolin et la révocation de l'appareil.
3. Préparer une photo **puis** une vidéo, copier le lien. Déconnecter le VPN et perdre le réseau sans fermer la page ; essayer actualisation/réessai, puis reconnecter. Média, lien déjà obtenu et étapes restent présents ; aucune recharge ni répétition automatique du POST. Les nouvelles données privées ne doivent pas revenir via un cache.
4. Recommencer avec une coupure pendant la génération du lien : média conservé, erreur compréhensible, réessai explicite après reconnexion. Une requête dont la réponse est perdue peut avoir abouti côté LinKs ; le bridge réutilise ses liens existants, aucun POST n'est rejoué automatiquement par PulSe.
5. Revenir d'Instagram, mettre l'app en arrière-plan, éteindre/rallumer l'écran, basculer Wi-Fi/4G. Vérifier la continuité de la page et le tunnel. Les paramètres batterie/Always-on sont à décider sur le téléphone, pas modifiés ici.
6. Fermer complètement puis relancer la PWA avec/sans VPN ; sans réseau, seul l'écran hors connexion générique peut être disponible. **Un brouillon en mémoire ne survit pas nécessairement à la fermeture, à un rechargement manuel ou à une destruction du processus par Android.** Aucune persistance privée n'est ajoutée. Ne pas confondre ce cas avec une simple coupure réseau dans une page vivante.
7. Tester notification de mise à jour pendant une préparation, y compris depuis un second onglet. Validation explicite toujours requise ; aucun rechargement de la préparation.

Conserver si possible la même origine HTTPS (schéma, hôte, port), après vérification des contraintes Pangolin. Un changement d'origine implique une autre installation PWA et ne transfère pas son état ; terminer les Stories avant la bascule.

## Preuves automatisées et limites

- Tests Node : routes sans connexion intégrée, secrets exclus des corps/en-têtes, normalisation des réponses, absence de propagation des cookies ou identifiants entrants vers LinKs, redirection Bearer refusée avec serveur destinataire non contacté.
- Chrome réel : service worker, installation/mises à jour, photo/vidéo ; refus d'accès simulé, coupure/reconnexion, actualisation et réessai en conservant la préparation ; cache privé toujours exclu. La coupure réseau est simulée, pas un vrai tunnel Pangolin.
- CI Docker : **vrai Traefik 3.6.1**, configuration générée, HTTPS avec certificat de recette vérifié par le client, anciens routeurs PulSe concurrents, refus publics sans exception, variantes de chemins, bridge interne PulSe réel et serveur LinKs fictif. Contrats des pages publiques/shortlinks conservés ; cela ne teste pas le LinKs déployé. Compose privé résolu et absence de port publié vérifiée.
- L'entrée privée de recette est une entrée HTTPS séparée sur loopback, **pas** une émulation de l'identité ou du VPN Pangolin. Seuls les essais VPS/Samsung peuvent valider ces points.

Commandes : `node --test tests/*.test.mjs`, `node tests/browser.cjs` (Playwright), puis `docker build -t pulse-validation .` et `node tests/edge-integration.mjs` (Docker + OpenSSL, machine de recette uniquement). Le test Docker crée/supprime ses seuls conteneurs/réseau temporaires et ne monte jamais le socket Docker dans Traefik. Aucun job de publication ne s'exécute sur cette branche.

## Risques et retour arrière

Risques restant ouverts : incompatibilité de version/site, DNS privé et certificat, erreur de priorité ou alias oublié, route TCP/directe oubliée, rupture du bridge si son URL devient publique, perte d'une préparation si Android détruit la page. La configuration est **conditionnelle** jusqu'à fermeture de ces points.

Avant toute future activation, sauvegarder localement de façon protégée les paramètres des seules ressources concernées, les fichiers proxy, le Compose PulSe, l'image par digest et les paramètres DNS/certificat. Conserver une session administrative indépendante du tunnel PulSe. Terminer les Stories avant toute bascule.

Retour arrière préféré : désactiver la nouvelle ressource privée défaillante, conserver le refus public PulSe, restaurer uniquement le précédent Compose/image PulSe et la cible interne nécessaire. Accepter une indisponibilité temporaire plutôt que rouvrir automatiquement Internet. Pour une erreur de blocage LinKs, retirer/restaurer seulement les routeurs ajoutés par cette phase ; ne pas toucher aux routes publiques, données ou volumes LinKs. Réexécuter les contrôles public/bridge. Rétablir l'ancien accès public serait une régression de confidentialité et demande une décision explicite, pas un rollback automatique. Aucun changement de base ou migration n'est à annuler.

La v1.1.5 ne doit être installée qu’après preuve de fermeture des anciennes ressources publiques et de tous les accès directs. Aucun simple drapeau applicatif ne remplace cette preuve.

## Ordre de bascule à valider séparément

1. **Lecture seule** : inventaire versions, routes/alias, IP/ports IPv4 et IPv6, membres des réseaux, règles pare-feu/proxy, ressources et permissions Pangolin. Relever aussi les politiques Dockhand et tout observateur de latest ; arrêter toute mise à jour automatique avant publication, dans une intervention autorisée.
2. Sur une recette isolée, vérifier ressource privée HTTPS, certificat/renouvellement, utilisateur autorisé, refus sans droit et révocation. Le service actuel reste inchangé pendant la préparation.
3. Après validation et accord d’intervention : sauvegarder les paramètres ciblés et l’image par digest ; fermer l’ancienne ressource publique et tous ses alias, poser le refus de bordure sans toucher au LinKs public ; tester depuis un réseau externe et via IP/SNI, IPv4/IPv6.
4. Publier seulement après validation technique, preuve d’isolation et confirmation qu’aucun consommateur automatique de latest n’exposera la nouvelle image. Le workflow manuel exige une URL de bilan et peut être protégé par des reviewers GitHub ; il ne certifie pas les preuves à la place de l’opérateur.
5. Après autorisation de déploiement séparée, remplacer le Compose autonome de la stack existante, vérifier les réseaux et le digest autorisé, puis tester client Pangolin connecté/déconnecté/sans droit, HTTPS, bridge et parcours Samsung/PWA. Ne jamais fusionner les anciens ports avec le modèle privé.
6. En cas d’échec, désactiver l’accès privé en défaut et restaurer uniquement l’image/configuration ciblées en conservant le refus public. Accepter une indisponibilité ; aucune réouverture publique automatique. LinKs, ses volumes et jetons restent en place.

**État : étapes opérateur non exécutées.** Un modèle Compose et une recette Traefik ne prouvent ni l’isolation du VPS ni les permissions Pangolin. Les informations de version et fonctions disponibles doivent être relevées sur l’instance réelle. Documentation officielle consultée le 31 octobre 2026 : [HTTPS privé](https://docs.pangolin.net/manage/resources/private/private-http), [DNS et réseau](https://docs.pangolin.net/self-host/dns-and-networking).

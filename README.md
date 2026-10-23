# PulSe V1 — socle fonctionnel mobile

**V1 en chantier, pas de publication en production.** Prototype indépendant de LinKs, compatible avec Docker et Pangolin. L'apparence définitive viendra après validation du fonctionnement.

## Fonctionnement livré

- Accueil prioritaire aux statistiques, panneau « Préparer une Story » fermé au démarrage.
- Le panneau s'ouvre verticalement **sous le bouton** et pousse les statistiques vers le bas, sans modale.
- Liste des campagnes **actives** provenant de l'API publique LinKs : `promo` et `featured`.
- Liste distincte des **liens suivis indépendants**, avec recherche, uniquement depuis la passerelle sécurisée LinKs. **Les liens classiques (`classic`) sont exclus.**
- Photo personnelle importée du smartphone, sans lien ou associée à une campagne / un lien suivi (jamais un lien classique).
- Préparation JPEG Story 1080×1920 avec conservation intégrale du visuel et fond flouté pour combler les marges.
- Boutons copier lien et partage Android natif, avec téléchargement de secours.
- Marquage manuel « Je l'ai publiée » : compteur local au navigateur, **pas** une statistique Instagram vérifiée.
- Statistiques réelles affichées **uniquement** si la passerelle privée LinKs répond. Sinon elles restent « — ».
- Conserve la même cible Pangolin `pulse-story-spike-test:4173` et l'authentification du prototype.

## Passerelle privée vers LinKs : branche GitHub de validation

Une nouvelle API dédiée à PulSe est développée sur la branche `feat/pulse-private-bridge` du dépôt `Mick7784/LinKs` (ne pas fusionner sans contrôles).

- `GET /api/pulse/links` : liens suivis actifs, sans liens classiques.
- `GET /api/pulse/stats` : clics réels des sept jours précédents et du jour, avec jours sans activité (clics publics + clics Stories + clics liens suivis).
- `POST /api/pulse/story-link` : génération des URLs courtes suivies, pour une promotion active ou un lien suivi indépendant, source Instagram Story.

**Activation après validation et publication d'une image LinKs intégrant le changement** :

1. Générer un secret aléatoire de 32 caractères minimum (`openssl rand -hex 32`).
2. Ajouter `PULSE_BRIDGE_TOKEN` au **conteneur LinKs**, dans ses variables d'environnement Dockhand. Ne pas publier le secret, ni l'inclure dans un dépôt Git.
3. Mettre à jour le conteneur LinKs avec une image construite à partir de la branche validée. Conserver son volume `/data` et ses autres variables inchangés. Sauvegarder avant migration.
4. Configurer **la même variable** `PULSE_BRIDGE_TOKEN` pour PulSe, avec `LINKS_BRIDGE_URL=http://domotik-links:8080` (ou laisser cette URL vide puisque `LINKS_PUBLIC_URL` est identique).
5. Reconstruire/redéployer uniquement PulSe, sans modifier Pangolin.

Un secret absent ou trop court désactive les routes privées dans LinKs (`404`). Un secret incorrect rend `401`. Le navigateur ne reçoit jamais le secret, seulement les données autorisées par PulSe.

Si la passerelle répond mal, PulSe **ne revient pas silencieusement** aux liens directs non suivis lorsque le tracking est configuré. L'API privée LinKs ne donne pas accès aux comptes, aux paramètres ni à la sauvegarde.

## Dockhand / Pangolin

Pour éviter un upload SSH, utilise `PulSe-Dockhand-Bridge-V1.yaml` (fichier livré à côté du ZIP) : Compose autonome avec `dockerfile_inline`.

Dans la stack Dockhand existante, conserver **PULSE_TEST_USER, PULSE_TEST_PASSWORD et PANGOLIN_PROXY_NETWORK=pangolin**, et renseigner si nécessaire `LINKS_PUBLIC_URL=http://domotik-links:8080` (par défaut). **Redéployer en reconstruisant l'image** ; seul PulSe est redémarré. Ne pas modifier la stack LinKs.

Pangolin reste en HTTPS public et cible HTTP : `http://pulse-story-spike-test:4173`, vérification de santé `/healthz`, TLS vers backend désactivé.

## Vérifications locales

```sh
node --test tests/*.test.mjs
PULSE_TEST_USER=admin PULSE_TEST_PASSWORD=une-phrase-longue LINKS_PUBLIC_URL=http://domotik-links:8080 node serve.mjs
```

## Limitations

- Le partage natif peut afficher Instagram dans Android, sans pouvoir imposer « Story » automatiquement.
- Instagram impose encore l'ajout manuel du sticker lien.
- Certaines images de bibliothèque `system:` dans LinKs ne sont pas encore rendues : galerie personnelle de secours.
- L'affichage des vrais liens suivis indépendants et des statistiques nécessite la passerelle privée LinKs, **nécessite une mise à jour LinKs validée et non déployée automatiquement**.
- Ne pas supprimer le prototype existant avant le test de régression sur Samsung.

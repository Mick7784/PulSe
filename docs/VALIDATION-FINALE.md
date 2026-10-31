# Validation du candidat correctif V1.1.5

Base : release v1.1.4, commit `00b3502edfc34c6c07ae8733ce3564c20c1c7dee`. Branche `feat/pulse-1.1.5-correctifs`. Audit du 31 octobre 2026. Aucune publication, fusion ni intervention VPS/Pangolin/Dockhand.

## Corrections

Stories visible dès le HTML et cohérent dans JavaScript, titre, lien d’évitement, navigation et Retour. Icônes standard/maskable 192 et 512 limitées au S officiel ; header complet inchangé. Liens sur une ligne de 50 px, séparateurs, crayon cyan/partage rose et cibles 44 × 44 px.

Connexion utilisateur retirée du serveur, Dockerfile, Compose, suites et guides. Bearer LinKs, contrôle d’origine/en-tête POST, refus des redirections et exclusions de cache privé maintenus. Les deux modèles Compose sont privés et autonomes, sans ports hôte ni ancien alias public. Aucun modèle ne prouve l’isolation réelle.

Publication automatique sur main retirée : déclenchement manuel explicite, bilan HTTPS approuvé et environnement `pulse-private-release`. Configurer des reviewers requis sur cet environnement avant usage ; l’URL et le nom d’environnement ne vérifient pas seuls les preuves. Tags version/latest et contrôles d’immutabilité conservés.

## Preuves locales

| Vérification | Résultat |
| --- | --- |
| Node, serveur, contrats, Bearer/CSRF et secrets | 18 tests réussis |
| Chrome, médias et parcours | Réussite photo/vidéo, préparation, copie, annulation, reprise, partage simulé, erreurs explicites et caches privés exclus |
| Cycle PWA | Réussite service worker réel, mise à jour explicite, deux onglets, brouillons photo/vidéo, échec d’installation, coupure/reconnexion et écran hors connexion |
| Compact mobile | Réussite 320/360/390/412/480 px × navigateur/standalone simulé, 100 noms longs/spéciaux, hauteur 48–52 px et cibles ≥44 px, ellipsis, focus, recherche URL, 0/1/100 résultats, clavier simulé |
| Démarrage et historique | Réussite Stories à l’ouverture, après rechargement depuis Stats et nouvelle page, Retour Stats → Liens → Stories ; titre et lien d’évitement vérifiés |
| Icônes | Dimensions et inclusion intégrale dans le cercle maskable vérifiées dans Chrome ; provenance et régénération dans assets/README.md |
| LinKs V1.329 local | Moteur du commit exact `8fbc2a5a2f1eee58f070c8f4cdc4a6a82819b560` : création/modification, affiliation, doublons, anciens jetons et clics, photo/vidéo, sources YouTube/Discord, pertes de réponse et SQLite jetable réussis |
| Image LinKs V1.329, Docker et Traefik | À confirmer par CI ; Docker indisponible sur le poste local |

La CI exécute également les gardes de release, Compose résolu, image LinKs publiée épinglée par digest, SQLite jetable, construction Docker et vrai Traefik. Consulter le résultat lié à la PR, pas les anciennes validations v1.1.4, pour connaître leur état sur ce candidat.

## Limites et condition de publication

L’isolation de la production n’a pas été inspectée ni validée. Versions/édition Pangolin, connecteur, client Android, droits/révocation, routes et alias, accès directs IP/ports IPv4/IPv6, réseaux Docker, DNS, certificat/renouvellement et bridge interne sont à vérifier selon ACCES-PRIVE.md. Inventorier aussi tout consommateur automatique de `latest` avant publication : publier une image pourrait provoquer un déploiement externe à la CI.

Aucun essai physique Samsung, tunnel réel, partage Instagram réel ou renouvellement TLS n’est validé par Chrome. L’icône d’une PWA installée peut rester ancienne jusqu’au rafraîchissement Android ou à une réinstallation après clôture des brouillons. Une préparation en mémoire ne survit pas forcément à une fermeture/destruction Android.

Maintenir la PR et les notes de release en préparation tant que les preuves d’isolation manquent. Aucun tag ou `latest` à promouvoir, aucune installation sur URL publique. Une future intervention nécessite validation et autorisation distinctes ; conserver le refus public lors d’un retour arrière, sans toucher aux volumes ou jetons LinKs.

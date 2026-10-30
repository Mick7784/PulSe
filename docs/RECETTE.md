# Recette physique de la refonte PulSe avant production

**À réaliser, non validée par les tests bureau.** Le [bilan final](VALIDATION-FINALE.md) distingue les preuves automatiques des vérifications VPS et Samsung. La cible de recette doit fournir l’extension LinKs `dfc67c4` (ou un successeur explicitement validé), avec HTTP Basic conservé.

## Préparer l’environnement

Préserver la stack V1 et son image. Utiliser une origine HTTPS de test et une instance LinKs de test disposant du bridge de gestion des liens et de synthèse mobile. Les secrets restent dans les variables Dockhand. Ne pas remplacer l’alias Pangolin de la stack utilisée tant que cette recette n’est pas acceptée. Aucun déploiement n’a été effectué par ce chantier.

## Compatibilité et parcours existants

Contrôler sur téléphone la présence du parcours visuel → copie → partage → sticker/publication → déclaration manuelle. Un partage résolu ou un retour d’Instagram ne termine jamais automatiquement le parcours. Le lien doit exister et être copié pour terminer ; avec LinKs V1.315 sans extension YouTube, vérifier le message explicite, le visuel encore préparé, le partage bloqué et la nouvelle tentative après mise à jour validée de la liaison.

Sur l’histogramme : valeurs blanches lisibles sans zoom en 7 jours, balayage horizontal en 30 jours, jour/valeur au toucher et dans le tableau. Aucun défilement horizontal de la page entière.

## Samsung / Chrome puis PWA

Noter téléphone, Android, Chrome et version Instagram. Comparer avec la version réellement en service, puis noter le commit et l’image de la version candidate.

1. Ouvrir PulSe : logo officiel dans l’en-tête, version au footer, panneau Story fermé, statistiques visibles, navigation Statistiques / Stories / Liens.
2. Choisir 7 puis 30 jours. Comparer total/jours à la base LinKs de test et au tableau du graphique. Couper l’accès au backend : valeurs « — », aucun graphique périmé.
3. Préparer la dernière vidéo. Vérifier titre/miniature, aperçu vertical et lien court. Copier le lien puis partager le JPEG avec deux taps distincts. Choisir Instagram/Story si proposé, ajouter le sticker Lien, coller, publier dans une audience de test.
4. Ouvrir ce sticker une fois depuis un navigateur normal. Vérifier destination de la vidéo, compteur quotidien et clic Story ; une simple préparation/copie ne doit pas compter comme clic. Faire évoluer ensuite la dernière vidéo LinKs : l’ancien lien reste dirigé vers sa vidéo d’origine.
5. Répéter avec une offre active et un lien suivi recherché par nom. Choisir une photo de galerie ; tester orientation portrait/paysage et JPEG/PNG. Aucune déformation de l’image, pas de téléversement.
6. Choisir une vidéo du téléphone. Vérifier lecture locale, format d’origine, partage et téléchargement de repli. La compatibilité des codecs/durée/formats reste celle du téléphone et d’Instagram ; PulSe ne convertit pas les vidéos.
7. Annuler le partage : média et lien restent préparés. Refuser la copie : sélection manuelle du lien disponible. Instagram absent ou partage de fichiers indisponible : enregistrer le média puis l’importer manuellement.
8. Installer l’app via le bouton ou les instructions navigateur. Ouvrir depuis son icône : « App installée », bouton désactivé. Tester l’annulation de l’invite et le retour depuis Instagram. Aucun compteur ou confirmation de publication automatique.
9. Refaire avec une offre expirée ou un lien désactivé : refus de préparation par LinKs. Les anciennes URL publiées gardent le comportement LinKs existant.

## iPhone/iPad

Safari → Partager → Sur l’écran d’accueil. Tester onglet et mode installé, photo avec orientation, vidéo et repli Photos/Fichiers. Une feuille de partage n’est pas une garantie d’ouverture de l’éditeur Story ; le sticker reste manuel. Ne pas affirmer une validation iOS à partir de Samsung ou du bureau.

## Vérification finale

### Complément phase 7 — à réaliser physiquement

Depuis Liens → Partager, choisir successivement YouTube puis Discord et comparer les URL courtes avec LinKs. Saisir un texte, refuser puis confirmer manuellement la copie, annuler puis réussir le partage natif. Vérifier la plateforme et le destinataire avant de publier manuellement. Changer de source ou modifier le texte doit exiger une nouvelle copie/confirmation, en conservant le texte. Tester une saisie trop longue, une coupure/reconnexion VPN, le changement de vue et une mise à jour PWA avec texte ouvert. La confirmation PulSe ne doit ni envoyer un message ni augmenter les statistiques.

Ouvrir ensuite chaque lien de recette depuis un autre navigateur : vérifier l'attribution à la bonne source et les classements 7/30 jours. Les classements portent seulement sur les liens suivis, avec cinq résultats au maximum ; le compteur de campagnes décrit l'éligibilité actuelle. En cas de connexion perdue ou de bridge ancien, aucun classement périmé ne doit rester visible. Vérifier le raccourci d'un lien actif depuis la carte et l'indisponibilité d'un lien archivé. La date de vidéo doit correspondre à la donnée LinKs, lorsqu'elle existe.

### Complément phase 6 — à réaliser sur Samsung

1. Avec au moins cinq campagnes éligibles dans LinKs, retrouver une campagne hors des trois emplacements publics, y compris une campagne historique `featured`. Rechercher son titre ou code promo ; vérifier son visuel spécifique ou par défaut et les informations dans la préparation.
2. Choisir une photo, puis un fichier illisible : conserver la photo et son lien. Annuler le remplacement de toute la préparation : rien ne doit disparaître. Refaire avec une vidéo compatible du téléphone.
3. Pendant la Story, créer un lien puis revenir avec le lien sélectionné et le même média. Refaire avec un doublon et un lien existant. Annuler la confirmation : conserver les deux préparations. Couper le VPN pendant l'enregistrement, revenir à la Story puis reprendre la saisie sans création automatique au retour du réseau.
4. Retirer une campagne dans LinKs pendant une préparation dont le lien a échoué : le réessai doit être refusé et le média conservé. Réactualiser le catalogue sans perdre la préparation. Pour une image distante non prise en charge, choisir un média du téléphone.
5. Refuser la copie, confirmer la copie manuelle, annuler puis réussir le partage natif. Vérifier dans Instagram le fichier, le sticker ajouté manuellement et la bonne destination. La confirmation PulSe reste une déclaration manuelle, sans publication automatisée. Vérifier le retour de la PWA et une mise à jour avec une Story et une saisie de lien ouvertes.

La phase 6 n'ajoute aucune migration ni configuration serveur. Un retour au commit PulSe `eed1b16` annule ses changements ; conserver les mêmes données et secrets LinKs. Les liens créés dans l'intervalle restent des liens LinKs ordinaires et ne doivent pas être supprimés s'ils ont été partagés.

Au moins trois parcours complets réussis sur chaque plateforme revendiquée et un repli réussi. Vérifier navigation clavier, absence de défilement horizontal et lisibilité à 320/390/768 px. Les captures CI utilisent exclusivement des données de test et ne prouvent aucune mesure de production.

Retour arrière : remettre l’ancien Compose/image PulSe et les mêmes variables. L’extension LinKs n’ajoute aucune table et ne réattribue aucun jeton existant ; les liens vidéo créés restent des liens privés LinKs ordinaires. Ne pas supprimer ces liens si des Stories les utilisent.

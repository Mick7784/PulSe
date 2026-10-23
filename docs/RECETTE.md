# Recette PulSe V1.1 avant production

## Préparer l’environnement

Préserver la stack V1 et son image. Utiliser une origine HTTPS de test et une instance LinKs de test disposant de l’extension V1.1. Les secrets restent dans les variables Dockhand. Ne pas remplacer l’alias Pangolin de la stack utilisée tant que cette recette n’est pas acceptée. Aucun déploiement n’a été effectué par ce chantier.

## Samsung / Chrome puis PWA

Noter téléphone, Android, Chrome et version Instagram. Répéter sur la V1 et la V1.1 pour comparer le comportement réel.

1. Ouvrir PulSe : texte seul dans l’en-tête, version au footer, panneau Story fermé, statistiques visibles.
2. Choisir 7 puis 30 jours. Comparer total/jours à la base LinKs de test et au tableau du graphique. Couper l’accès au backend : valeurs « — », aucun graphique périmé.
3. Préparer la dernière vidéo. Vérifier titre/miniature, aperçu vertical et lien court. Copier le lien puis partager le JPEG avec deux taps distincts. Choisir Instagram/Story si proposé, ajouter le sticker Lien, coller, publier dans une audience de test.
4. Ouvrir ce sticker une fois depuis un navigateur normal. Vérifier destination de la vidéo, compteur quotidien et clic Story ; une simple préparation/copie ne doit pas compter comme clic. Faire évoluer ensuite la dernière vidéo LinKs : l’ancien lien reste dirigé vers sa vidéo d’origine.
5. Répéter avec une offre active et un lien suivi recherché par nom/catégorie. Choisir une photo de galerie ; tester orientation portrait/paysage et JPEG/PNG. Aucune déformation de l’image, pas de téléversement.
6. Choisir une vidéo du téléphone. Vérifier lecture locale, format d’origine, partage et téléchargement de repli. La compatibilité des codecs/durée/formats reste celle du téléphone et d’Instagram ; PulSe ne convertit pas les vidéos.
7. Annuler le partage : média et lien restent préparés. Refuser la copie : sélection manuelle du lien disponible. Instagram absent ou partage de fichiers indisponible : enregistrer le média puis l’importer manuellement.
8. Installer l’app via le bouton ou les instructions navigateur. Ouvrir depuis son icône : « App installée », bouton désactivé. Tester l’annulation de l’invite et le retour depuis Instagram. Aucun compteur ou confirmation de publication automatique.
9. Refaire avec une offre expirée ou un lien désactivé : refus de préparation par LinKs. Les anciennes URL publiées gardent le comportement LinKs existant.

## iPhone/iPad

Safari → Partager → Sur l’écran d’accueil. Tester onglet et mode installé, photo avec orientation, vidéo et repli Photos/Fichiers. Une feuille de partage n’est pas une garantie d’ouverture de l’éditeur Story ; le sticker reste manuel. Ne pas affirmer une validation iOS à partir de Samsung ou du bureau.

## Vérification finale

Au moins trois parcours complets réussis sur chaque plateforme revendiquée et un repli réussi. Vérifier navigation clavier, absence de défilement horizontal et lisibilité à 320/390/768 px. Les captures CI utilisent exclusivement des données de test et ne prouvent aucune mesure de production.

Retour arrière : remettre l’ancien Compose/image PulSe et les mêmes variables. L’extension LinKs n’ajoute aucune table et ne réattribue aucun jeton existant ; les liens vidéo créés restent des liens privés LinKs ordinaires. Ne pas supprimer ces liens si des Stories les utilisent.

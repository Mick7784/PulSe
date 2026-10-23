export function installationHelp(userAgent='',touchPoints=0){
 const ios=/iPad|iPhone|iPod/.test(userAgent)||(/Macintosh/.test(userAgent)&&touchPoints>1);
 if(ios)return /CriOS|FxiOS|EdgiOS/.test(userAgent)?'Ouvrez cette page dans Safari, puis Partager → Sur l’écran d’accueil.':'Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.';
 if(/Android/.test(userAgent))return 'Dans Chrome : menu ⋮ → Installer l’application ou Ajouter à l’écran d’accueil. Si PulSe est déjà installée, ouvrez-la depuis son icône.';
 return 'Utilisez l’option Installer dans la barre d’adresse ou le menu de Chrome ou Edge. Si elle manque, réessayez en HTTPS dans un navigateur compatible.';
}

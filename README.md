# Arbres de Montréal — TP3

Application de bureau pour explorer un échantillon d’arbres publics de Montréal et gérer une collection avec persistance. Elle permet de repérer les essences, consulter les coordonnées et comparer les diamètres.

## Captures d'écran

### Tableau de bord

![Tableau de bord](docs/screenshots/accueil.png)

### Carte

![Carte](docs/screenshots/carte.png)

### Mes Favoris

![Favoris](docs/screenshots/favoris.png)

### Ajouter un arbre

![Ajouter un arbre](docs/screenshots/ajouter_arbre.png)

## Équipe et dépôt

- Eva Bessette : recherche en Rust, anti-rebond (debounce) de la recherche, optimisation de la recherche, branchement des statistiques Rust au service Vue, vérifications avant la remise (formatage Rust, compilation, build), mise à jour du README.
- Marc-André Dufour : backend Tauri, commands.rs, persistance JSON, favoris, observations, gestion des erreurs, pages Vue (formulaire, tableau de bord, liste des arbres, favoris).
- Charles Legault : carte; import CSV; rechercher, filtrer, trier, et suggestions en Javascript; fichiers models.rs, validation.rs, statistiques.rs; amélioration des pages Vue (formulaire, tableau de bord, liste des arbres, favoris).
- Dépôt du cours : https://github.com/E26-DA1B/projet_eva_marc-andre_charles

## Fonctionnalités

- Tableau de bord : total, nombre d’essences et d’arrondissements, diamètre moyen.
- Carte interactive : position des arbres, sélection d’un point et accès à la modification.
- Liste paginée : recherche (en Rust) sans distinction de casse ni d’accents, filtre par arrondissement, tri par essence ou diamètre.
- Formulaire d’ajout et de modification : six champs, messages de validation et confirmation de succès.
- Suppression avec confirmation et possibilité d’annuler.
- Favoris : ajout/retrait depuis la liste ou la carte; page « Mes favoris » avec compteur, recherche, filtre et tri. Retirer un favori conserve l’arbre dans la collection.
- États de chargement, erreur avec nouvelle tentative, collection vide et recherche sans résultat.
- Données partagées en mémoire : les changements se reflètent entre les vues et sont persistants grâce à trois fichiers JSON sauvegardés par le backend Rust, et conservés même après un redémarrage.

## Technologies et prérequis

Vue 3, Vue Router 4 (navigation par hash adaptée à Tauri), JavaScript, Vite, npm, Tauri 2 et Rust. La carte utilise MapLibre GL; Papa Parse lit le CSV.

Prérequis :

- Node.js 22 LTS et npm.
- Rust stable avec Cargo.
- Sous Windows : Microsoft C++ Build Tools avec la charge de travail « Développement Desktop en C++ », Windows SDK et WebView2.
- Pour les autres systèmes, installer les prérequis Tauri correspondants : https://v2.tauri.app/start/prerequisites/
- Internet pour installer les dépendances et afficher le fond de carte détaillé OpenFreeMap. La liste, les formulaires et les calculs utilisent uniquement les données locales.

## Installation et démarrage

Dans le dossier du projet :

```bash
npm install
npm run tauri dev
```

Une fenêtre « Arbres de Montréal » s’ouvre. Le port local 1420 doit être disponible.

Sous PowerShell, si les scripts npm sont bloqués, utiliser `npm.cmd install` et `npm.cmd run tauri dev`.

Aperçu dans un navigateur (ne remplace pas la vérification de la fenêtre Tauri) :

```bash
npm run dev
```

## Données et règles

Le fichier livré `public/data/liste_arbre.csv` contient 122 480 arbres, 604 essences et 13 arrondissements.

Javascript lit ce fichier CSV au premier chargement de l'application, envoie les arbres à Rust (`importer_arbres`), et Rust les sauvegarde dans `arbres.json`. Après cela, Rust lit `arbres.json`.

Validation du formulaire :

- Essence française et arrondissement obligatoires, après suppression des espaces superflus.
- Champs de texte limités à 120 caractères; nom latin facultatif.
- Diamètre obligatoire entre 0,1 et 1 000 cm.
- Longitude entre -180 et 180; latitude entre -90 et 90, toutes deux obligatoires.
- Les diamètres absents dans les données importées sont affichés « Non renseigné » et exclus de la moyenne.
- Les identifiants de session sont distincts du numéro d’inventaire municipal.

## Vérifications

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm test
npm run build
npm run tauri dev
```

Les tests Node couvrent le fichier livré, les erreurs de CSV, la validation, les mutations, la nouvelle tentative de chargement, les filtres et les calculs. Les tests Rust vérifient les règles de validation du backend (validation.rs).

## Architecture

Voir [architecture-application.md](architecture-application.md) pour les vues, les données, le contrat du service et les modules Rust.

## Persistance

On utilise trois fichiers JSON sauvegardés par Rust, arbres.json, favoris.json et observations.json (que l'on peut trouver dans `%APPDATA%\com.arbresmontreal.app` sur Windows). On a choisi JSON parce que c'est relativement simple à utiliser avec Rust (Serde convertit les `Arbre` en JSON), et les données sont facilement lisibles, ce qui aide au débogage. De plus, tout reste local : pas besoin de se connecter à un serveur ou d'installer une base de données.

Seul bémol : chaque changement réécrit le fichier au complet, ce qui peut devenir lourd lorsqu'on a 122 480 arbres.

## Limites

- Le fond détaillé dépend d’OpenFreeMap et de WebGL. Un message indique une indisponibilité; les points peuvent rester sur un fond simplifié et la liste demeure accessible.
- Le module MapLibre est volumineux; il est chargé seulement à l’ouverture de la vue Carte. L’avertissement de taille Vite n’empêche pas le build.
- Pas de contrôle géographique limité à Montréal : seules les bornes mondiales des coordonnées sont vérifiées.
- La page Carte utilise encore la recherche en JavaScript. Seulement la page Liste et la page Favoris utilisent la recherche en Rust.
- La recherche prend environ une seconde, parce que Rust relit et analyse arbres.json à chaque recherche.

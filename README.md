# Puzzle Laser Generator

Application web statique (HTML/CSS/JS pur, sans dépendance) qui génère des
puzzles photo à taquets classiques ("jigsaw") exportables en SVG pour
découpe laser (testé pour xTool M2, compatible avec tout logiciel acceptant
du SVG en unités millimétriques : LightBurn, xTool Creative Space, etc.).

## Fonctionnalités

- Upload d'une photo, aperçu en direct du découpage.
- Dimensions du puzzle en millimètres, avec verrouillage du ratio de la photo.
- Nombre de colonnes / lignes configurable (nombre de pièces).
- Forme des taquets réglable (taille, irrégularité, graine aléatoire pour
  reproduire ou varier un motif).
- Export SVG :
  - unités en millimètres (`viewBox` = dimensions réelles),
  - trait de découpe fin (0.1 mm), couleur configurable,
  - calque photo optionnel (image raster intégrée en base64) pour repère
    visuel avant découpe/gravure.

## Utilisation en local (sans Docker)

Double-cliquer sur le lanceur correspondant à votre OS, qui démarre un
petit serveur HTTP local et ouvre l'app dans le navigateur :

- Windows : `start-windows.bat`
- macOS / Linux : `start-mac-linux.sh`

(Nécessite Python 3, déjà présent par défaut sur macOS/Linux.)

## Déploiement en conteneur Docker (Portainer ou autre)

L'app est packagée comme un simple conteneur Nginx statique, indépendant de
tout autre système (pas d'intégration Home Assistant).

### Avec Docker Compose / Portainer (stack)

```bash
docker compose up -d --build
```

Puis ouvrir <http://localhost:5052/> (port modifiable dans
`docker-compose.yml`).

Pour un déploiement via Portainer : créer une nouvelle **Stack**, coller le
contenu de `docker-compose.yml` (ou pointer vers ce dépôt Git), et déployer.

### Avec Docker seul

```bash
docker build -t puzzle-laser-generator .
docker run -d --name puzzle-laser-generator -p 5052:80 puzzle-laser-generator
```

## Structure du projet

```
README.md
Dockerfile              # image Nginx servant le contenu statique
docker-compose.yml       # stack Portainer / Docker Compose
start-windows.bat         # lanceur local Windows
start-mac-linux.sh        # lanceur local macOS/Linux
www/
  index.html
  style.css
  app.js                  # génération du puzzle + export SVG
```

## Notes découpe laser

- Le SVG exporté utilise 1 unité SVG = 1 mm (via l'attribut `viewBox`
  combiné aux attributs `width`/`height` en `mm`) : à importer tel quel,
  sans redimensionnement, dans le logiciel de pilotage laser.
- Le calque de découpe (`id="cut"`) contient uniquement des traits fins
  (`stroke-width: 0.1mm`) sans remplissage, pour être reconnu comme
  vectoriel/découpe par la plupart des logiciels laser.
- Le calque photo (`id="photo"`), s'il est inclus, est une image raster :
  à utiliser comme repère de calage ou pour une gravure séparée, pas pour
  la découpe.

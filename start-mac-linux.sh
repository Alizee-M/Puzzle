#!/usr/bin/env bash
set -e

PORT=8765
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/www"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 est requis pour lancer le serveur local."
  echo "Installez-le puis relancez ce script."
  exit 1
fi

echo "Demarrage de Puzzle Laser Generator sur http://localhost:${PORT}/"

if command -v open >/dev/null 2>&1; then
  (sleep 1 && open "http://localhost:${PORT}/") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "http://localhost:${PORT}/") &
fi

cd "$DIR"
python3 -m http.server "$PORT"

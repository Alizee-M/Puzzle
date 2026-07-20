@echo off
setlocal

set PORT=8765
set DIR=%~dp0www

echo Demarrage de Puzzle Laser Generator sur http://localhost:%PORT%/
start "" http://localhost:%PORT%/

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    cd /d "%DIR%"
    python -m http.server %PORT%
) else (
    where py >nul 2>nul
    if %ERRORLEVEL%==0 (
        cd /d "%DIR%"
        py -m http.server %PORT%
    ) else (
        echo Python est requis pour lancer le serveur local.
        echo Installez Python depuis https://www.python.org/downloads/ puis relancez ce script.
        pause
    )
)

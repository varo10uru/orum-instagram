#!/bin/zsh
# ===========================================================================
# DISPARADOR DESDE LA MAC: lanza "Publicar" en modo pendientes
#
# GitHub atrasa o se saltea las corridas programadas (el 12/10/2026 no
# corrió ninguna en toda la tarde). Esta tarea de la Mac lanza "Publicar"
# a los minutos 9 y 39 de cada hora, de 10 a 22: publica lo de hoy que ya
# tiene la hora cumplida, y lo ya publicado no se repite. Usa el `gh` que
# ya está conectado a GitHub: no necesita tokens nuevos.
#
# Solo corre con la Mac prendida. Si está dormida, macOS la corre una vez
# apenas se despierta.
#
# Uso:
#   zsh scripts/disparar-desde-la-mac.sh --instalar   deja la tarea andando
#   zsh scripts/disparar-desde-la-mac.sh --sacar      la saca
#   zsh scripts/disparar-desde-la-mac.sh              lanza una vez (lo hace la tarea)
# Registro: ~/Library/Logs/orum-publicar.log
# ===========================================================================

ETIQUETA="uy.orum.publicar"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
REGISTRO="$HOME/Library/Logs/orum-publicar.log"
SCRIPT="${0:A}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

case "$1" in
  --instalar)
    # Minutos 9 y 39, de 10 a 22 (hora de la Mac, que es la de Uruguay)
    horarios=""
    for hora in {10..22}; do
      for minuto in 9 39; do
        horarios+="    <dict><key>Hour</key><integer>$hora</integer><key>Minute</key><integer>$minuto</integer></dict>
"
      done
    done
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$SCRIPT</string></array>
  <key>StartCalendarInterval</key>
  <array>
$horarios  </array>
  <key>StandardOutPath</key><string>$REGISTRO</string>
  <key>StandardErrorPath</key><string>$REGISTRO</string>
</dict>
</plist>
EOF
    launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null
    launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "Listo: la tarea $ETIQUETA quedó instalada. Registro: $REGISTRO"
    ;;
  --sacar)
    launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null
    rm -f "$PLIST" && echo "Listo: la tarea $ETIQUETA se sacó."
    ;;
  *)
    salida=$(gh workflow run publicar.yml -R varo10uru/orum-instagram -f franja=pendientes 2>&1)
    echo "$(date '+%F %H:%M') ${salida##*$'\n'}"
    ;;
esac

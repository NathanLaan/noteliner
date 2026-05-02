#!/bin/bash
# Generate and install a .desktop file for NoteLiner with correct paths
# Run from anywhere: bash scripts/install-desktop.sh
# Skips silently on non-Linux systems.

if [ "$(uname)" != "Linux" ]; then
  exit 0
fi

# Skip in CI runners — the runner's $HOME is ephemeral, the desktop entry
# would be useless, and electron-builder's packaging step doesn't need it.
if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/noteliner.desktop"

mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=NoteLiner
Comment=An outliner-style note-taking application
Exec=npx --prefix "$PROJECT_DIR" electron "$PROJECT_DIR"
Icon=$PROJECT_DIR/assets/icon.png
Type=Application
Categories=Utility;TextEditor;
StartupWMClass=NoteLiner
EOF

echo "Installed: $DESKTOP_FILE"
echo "Icon:      $PROJECT_DIR/assets/icon.png"
echo "You may need to log out/in for GNOME to pick it up."

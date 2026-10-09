#!/usr/bin/env bash
# scripts/vercel-ignore-build.sh
# Erstellt: 09.10.2026 — Builds überspringen, wenn sich nichts geändert hat, was in den Build eingeht.
#
# Vercel ruft dieses Skript vor jedem Build auf (vercel.json: ignoreCommand).
#   Exit 0 = Build überspringen, Exit 1 = bauen.
# Verglichen wird mit dem zuletzt erfolgreich gebauten Commit dieses Branches
# (VERCEL_GIT_PREVIOUS_SHA), nicht nur mit dem Vorgänger-Commit. So wird ein
# Push aus „Code + Doku“ nie fälschlich übersprungen. Im Zweifel wird gebaut.

if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "Kein Vergleichs-Commit bekannt: Build läuft."
  exit 1
fi

if ! git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null; then
  echo "Vergleichs-Commit nicht im Klon vorhanden: Build läuft."
  exit 1
fi

# Alles außer Dokumentation, Aufgaben-/Koordinationsdateien, Forschungsnotizen,
# CI-Workflows und SQL-Migrationen (die laufen in der Datenbank, nicht im Build).
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude)docs' \
  ':(exclude)external-tasks' \
  ':(exclude)internal-tasks' \
  ':(exclude)coordination' \
  ':(exclude)experiments' \
  ':(exclude).kueper' \
  ':(exclude).github' \
  ':(exclude)supabase' \
  ':(exclude)*.md'; then
  echo "Nur Dokumentation/Aufgaben/Migrationen geändert: Build wird übersprungen."
  exit 0
fi

echo "Build-relevante Änderungen gefunden: Build läuft."
exit 1

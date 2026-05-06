#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
OUT_DIR="$ROOT_DIR/build/appstore"
ARCHIVE_PATH="$OUT_DIR/FreeOfflineTranslator.xcarchive"
IPA_DIR="$OUT_DIR/ipa"
EXPORT_OPTIONS="$OUT_DIR/ExportOptions.plist"

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export HERMES_CLI_PATH="${HERMES_CLI_PATH:-$ROOT_DIR/node_modules/hermes-compiler/hermesc/osx-bin/hermesc}"

mkdir -p "$OUT_DIR" "$IPA_DIR"
rm -rf "$ARCHIVE_PATH" "$IPA_DIR"
mkdir -p "$IPA_DIR"

if [[ ! -x "$HERMES_CLI_PATH" ]]; then
  echo "Hermes compiler not found at: $HERMES_CLI_PATH" >&2
  exit 1
fi

cd "$IOS_DIR"
pod install --repo-update

ROOT_DIR_ESCAPED="$(printf '%s\n' "$ROOT_DIR" | sed 's/[\/&]/\\&/g')"
find "$IOS_DIR/Pods" \
  \( -name '*.xcconfig' -o -name '*.podspec.json' \) \
  -type f \
  -print0 | xargs -0 sed -i '' -E \
  "s#/Users/[^/]+/(Documents|Downloads)/travel-translator#${ROOT_DIR_ESCAPED}#g"

xcodebuild \
  -workspace TravelTranslator.xcworkspace \
  -scheme TravelTranslator \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$IPA_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

echo "IPA exported to: $IPA_DIR"

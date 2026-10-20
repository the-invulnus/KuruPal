#!/bin/sh
# Usage: agent-hook.sh happy
set -eu
case "${1:-}" in
  idle|happy|celebrate|joyfulLaugh|sad|panic|pray|tearful|idlePeek|idleSmug|idleNervous) field=action; value=$1 ;;
  task_started|working|waiting_for_user|task_succeeded|task_failed|task_cancelled) field=event; value=$1 ;;
  *) echo 'Usage: agent-hook.sh <action|task_started|working|waiting_for_user|task_succeeded|task_failed|task_cancelled>' >&2; exit 2 ;;
esac
case "$(uname -s)" in
  Darwin) base="$HOME/Library/Application Support" ;;
  Linux) base="${XDG_DATA_HOME:-$HOME/.local/share}" ;;
  *) echo 'This helper supports macOS and Linux.' >&2; exit 2 ;;
esac
inbox="$base/studio.marketpet.desktop/hooks"
umask 077
mkdir -p "$inbox"
tmp=$(mktemp "$inbox/.pending.XXXXXX")
trap 'rm -f "$tmp"' EXIT HUP INT TERM
created=$(date +%s)
printf '{"%s":"%s","createdAt":%s000}\n' "$field" "$value" "$created" > "$tmp"
mv "$tmp" "$inbox/$created-${tmp##*.}.json"

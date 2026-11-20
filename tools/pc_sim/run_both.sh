#!/usr/bin/env bash
# Build board_sim.cpp twice (pre = ESP32 DevKit V1 build, post = ESP32-S3 build)
# and run both boards at the same time. Extra options go to both boards, e.g.:
#   ./run_both.sh                 # real Device 0001 + 0005, every 60 s, 10 uploads each
#   ./run_both.sh -i 15 -n 20     # every 15 s, 20 uploads each
#   ./run_both.sh --sim -i 5 -n 2 # simulated Device 0006 + 0007 (hidden on the dashboard)
# Credentials come from firmware/esp32/FF/secrets.h (git-ignored), like the firmware.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ff="$here/../../firmware/esp32/FF"
# -Wno-unused-function: telemetry.h has helpers only its ESP32 task uses
flags=(-std=gnu++17 -O2 -Wall -Wextra -Wno-unused-function -I"$here/shim" -I"$ff")

g++ "${flags[@]}" -DCONFIG_IDF_TARGET_ESP32=1   "$here/board_sim.cpp" "$ff/api_client.cpp" -o "$here/board_sim_pre"
g++ "${flags[@]}" -DCONFIG_IDF_TARGET_ESP32S3=1 "$here/board_sim.cpp" "$ff/api_client.cpp" -o "$here/board_sim_post"

"$here/board_sim_pre"  "$@" 2>&1 | sed -u 's/^/[pre ] /' &
pre=$!
"$here/board_sim_post" "$@" 2>&1 | sed -u 's/^/[post] /' &
post=$!
trap 'kill -INT $pre $post 2>/dev/null' INT
wait $pre $post

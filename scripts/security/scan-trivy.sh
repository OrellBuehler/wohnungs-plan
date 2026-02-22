#!/usr/bin/env bash
set -euo pipefail

# Trivy security scan — filesystem vulnerability/secret/misconfig scan and IaC config scan.
# Optionally builds and scans the Docker image with --image flag.
#
# Usage:
#   ./scripts/security/scan-trivy.sh             # filesystem + IaC scans
#   ./scripts/security/scan-trivy.sh --image     # also build and scan Docker image

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if ! command -v trivy &>/dev/null; then
  echo "ERROR: trivy is not installed." >&2
  echo "Run ./scripts/security/install-tools.sh or visit: https://aquasecurity.github.io/trivy/" >&2
  exit 1
fi

SCAN_IMAGE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) SCAN_IMAGE=true; shift ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--image]" >&2
      exit 1
      ;;
  esac
done

EXIT_CODE=0

# ── Filesystem scan ──────────────────────────────────────────────────────────

echo "=== Trivy filesystem scan ==="
if ! trivy fs "${REPO_ROOT}" \
    --scanners vuln,secret,misconfig \
    --severity CRITICAL,HIGH \
    --skip-dirs node_modules,.svelte-kit,build,.worktrees \
    --exit-code 1; then
  EXIT_CODE=1
fi

# ── IaC config scan ──────────────────────────────────────────────────────────

echo ""
echo "=== Trivy IaC config scan ==="
if ! trivy config "${REPO_ROOT}" \
    --severity CRITICAL,HIGH \
    --exit-code 1; then
  EXIT_CODE=1
fi

# ── Docker image scan (optional) ─────────────────────────────────────────────

if [[ "${SCAN_IMAGE}" == "true" ]]; then
  if ! command -v docker &>/dev/null; then
    echo ""
    echo "WARNING: docker not found, skipping image scan" >&2
  else
    echo ""
    echo "=== Building and scanning Docker image ==="
    if docker build -t wohnungs-plan:scan -f "${REPO_ROOT}/Dockerfile" "${REPO_ROOT}" --quiet; then
      if ! trivy image "wohnungs-plan:scan" \
          --severity CRITICAL \
          --exit-code 1; then
        EXIT_CODE=1
      fi
    else
      echo "WARNING: failed to build image, skipping scan" >&2
    fi
  fi
fi

exit "${EXIT_CODE}"

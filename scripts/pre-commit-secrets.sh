#!/usr/bin/env bash
# Pre-commit hook: reject commits that contain obvious secrets.
# Install: cp scripts/pre-commit-secrets.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -euo pipefail

# Patterns that should NEVER appear in committed code
PATTERNS=(
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'  # UUID (potential API keys)
  'nvapi-[A-Za-z0-9_-]{20,}'       # NVIDIA API key
  'sk-[A-Za-z0-9]{20,}'            # OpenAI-style key
  'ghp_[A-Za-z0-9]{30,}'           # GitHub PAT
  'AKIA[A-Z0-9]{16}'               # AWS access key
  'bot[0-9]{8,}:[A-Za-z0-9_-]{30,}' # Telegram bot token
)

# Files to exclude from checks (known safe patterns)
EXCLUDE_PATTERNS='node_modules|\.env\.example|\.env\.template|test/|__tests__/'

FOUND=0

for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(git diff --cached --diff-filter=ACMR -U0 | grep -E "^\+" | grep -v "^+++" | grep -E "$pattern" | grep -vE "$EXCLUDE_PATTERNS" || true)
  if [ -n "$MATCHES" ]; then
    echo "⛔ BLOCKED: Potential secret detected in staged changes!" >&2
    echo "Pattern: $pattern" >&2
    echo "$MATCHES" | head -5 >&2
    echo "" >&2
    FOUND=1
  fi
done

# Also check for common secret filenames being added
SECRET_FILES=$(git diff --cached --name-only --diff-filter=A | grep -E '(\.env$|credentials\.json$|secrets\.json$|privy\.json$|solana\.json$|\.pem$|\.key$|keypair\.json$)' || true)
if [ -n "$SECRET_FILES" ]; then
  echo "⛔ BLOCKED: Secret file being committed!" >&2
  echo "$SECRET_FILES" >&2
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo "" >&2
  echo "To bypass (if you're sure): git commit --no-verify" >&2
  exit 1
fi

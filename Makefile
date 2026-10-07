# Local mirror of the CI jobs in .github/workflows/ci.yml.
# CI is still the source of truth; these targets just let you catch failures before pushing.
#
# Usage:
#   make install           # one-time: npm ci + install git hooks
#   make check             # everything CI runs
#   make check-pre-commit  # hooks only (gitleaks, hygiene)
#   make check-web         # lint, format check, build (tsc), npm audit
#
# Prerequisites: node/npm, pre-commit.

ifeq ($(OS),Windows_NT)
SHELL := C:/Program Files/Git/bin/bash.exe
endif

.PHONY: install check check-pre-commit check-web

install:
	npm --prefix apps/web ci
	pre-commit install

check: check-pre-commit check-web

# ─── pre-commit ───────────────────────────────────────────────────────────────
check-pre-commit:
	pre-commit run --all-files

# ─── web ──────────────────────────────────────────────────────────────────────
check-web:
	@echo "── oxlint ──"
	npm --prefix apps/web run lint
	@echo "── prettier ──"
	npm --prefix apps/web run format:check
	@echo "── build (tsc + vite) ──"
	npm --prefix apps/web run build
	@echo "── npm audit ──"
	npm --prefix apps/web audit --audit-level=high --omit=dev

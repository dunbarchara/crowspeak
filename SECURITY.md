# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on this repository
(private vulnerability reporting). Include the affected area or commit, reproduction steps
and the impact you see.

You can expect an acknowledgement within a few days. Fixes are released as soon as practical,
and reporters are credited unless they prefer otherwise.

## Scope

This repository contains the CrowSpeak web app and (as it is added) the auth/billing backend
and infrastructure code. Secrets must never be committed; use git-ignored `.env` files and
document required variables in `.env.example`.

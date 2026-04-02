# Audit Issues

These files are issue-ready writeups derived from the repository audit.
Each file is intended to be copied into whatever workflow you want to use.

Suggested issue list:

1. `01-harden-mail-send-ipc.md`
   Priority: high
   Labels: security, bug, ipc, mail

2. `02-reset-stale-message-context.md`
   Priority: medium
   Labels: bug, ui, state-management

3. `03-test-connection-should-not-save.md`
   Priority: medium
   Labels: bug, settings, ux

4. `04-search-should-return-newest-results.md`
   Priority: medium
   Labels: bug, imap, search

5. `05-validate-external-url-schemes.md`
   Priority: medium
   Labels: security, electron, hardening

6. `06-sync-docs-with-runtime-behavior.md`
   Priority: low
   Labels: documentation, consistency, security

Validation status at the time of this audit:

- `npm run test`: passed
- `npm run typecheck`: passed
- `npm run build`: passed

These issues are not build-breaking regressions. They are behavior, security,
and consistency gaps that currently sit outside the tested surface.

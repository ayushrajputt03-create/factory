# Marketplace foundation runbook

The new marketplace policy defaults browsing and demo checkout off. Real checkout and settlements remain disabled in code. The existing legacy payment Functions are separate and must be evaluated independently before deployment.

Verify with `npm test`, `npm run build`, and `npm --prefix functions test`. Inspect dependency audit artifacts and run emulator rules tests before production deployment.

The `marketplaceHealth` HTTP Function exposes liveness only. HTTP 200 does not imply payment, database or settlement readiness.

Rollback: restore the previous frontend release using the hosting provider's deployment history. Roll back only changed Functions to their previous reviewed revision. Preserve database and audit records; do not delete orders or rewrite financial history. Disable new checkout entry points before backend rollback. No schema migration is introduced in this slice.

# Secrets-Leak Post-Mortem Playbook

When a secret leaks — git history, log, screenshot, public artefact — what to do, in what order, within what timeline.

## TL;DR (human)

A leaked secret is compromised the moment it touches a public channel. Assume worst case. Rotate immediately; revoke aggressively; investigate scope; communicate honestly; close the gap that allowed the leak. Speed beats completeness — a half-rotation in 10 minutes is better than full rotation in 4 hours.

## For agents

### Trigger — what counts as a leak

| Channel | Treat as leaked? |
|---|---|
| Pushed to a public repo | Yes |
| Pushed to a private repo viewable by > 1 person | Yes (treat as leaked) |
| In a CI log accessible to broader audience | Yes |
| In a screenshot shared on chat / ticket / forum | Yes |
| In a stack trace returned to end users | Yes |
| In an error log readable by support team | Yes (depends on policy) |
| Committed locally but never pushed | No (still rotate; cheap insurance) |
| Found by a scanner, surface unknown | Treat as leaked |

When in doubt: **treat as leaked**. The cost of rotation is small; the cost of dismissing a real leak is huge.

### Severity ladder

| Sev | Trigger | First-response time |
|---|---|---|
| **SEV-1** | Production secret (prod DB password, payment processor key, signing key, sealer key) leaked publicly | ≤ 15 min |
| **SEV-2** | Production secret leaked to a small audience (internal Slack, private repo with > 5 viewers) | ≤ 1 h |
| **SEV-3** | Non-prod secret (staging, dev) leaked | ≤ 24 h |
| **SEV-4** | Suspected-leak with low confidence | Investigate first; rotate if confirmed |

Use the on-call paging path (per [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md)) for SEV-1/2.

### The minute-by-minute response (SEV-1)

**Minute 0–5: Confirm + rotate**

1. Confirm the leak: which secret, where exposed, when first exposed.
2. **Rotate the secret immediately**. New value in the vault; old value flagged revoked.
3. Push the new value to all consumers (deploys / restarts as needed).
4. The old secret is now inert; even if attackers have it, it cannot authenticate.

This is the highest-leverage 5 minutes. Everything else can wait; this cannot.

**Minute 5–20: Contain blast radius**

1. **Revoke at the issuer** (not just the vault):
   - API key: call the provider's revoke endpoint.
   - OAuth token: revoke via provider OAuth admin.
   - Signing key: publish revocation; rotate signed artefacts.
   - DB password: alter user; flush sessions.
2. **Block the channel**: delete the public commit / log / chat message. Note — **deletion does not retroactively undo exposure**; treat as leaked.
3. **Audit recent use of the secret**: who used it, when, from where. Anomalies = possible attacker use.

**Minute 20–60: Forensic scope**

1. Determine **how long** the secret was exposed (commit history, log retention, etc.).
2. Determine **who could have seen it** (repo visibility, log access, channel membership).
3. Determine **what the secret could access** (the actual blast radius).
4. Pull access logs for the secret's scope (API audit logs, DB query logs, file access).
5. Look for anomalies during the exposure window.

**Hour 1–24: Communication + cleanup**

1. **Internal comms**: post in #security; brief leadership.
2. **Customer comms** (if customer data potentially at risk): draft per legal review; transparent within regulatory window (GDPR 72h notification if PII compromised).
3. **Git history scrub** (if applicable): force-push to remove from history. **Note — this does not retract the leak**; the secret remains compromised. Scrub for hygiene, not safety.
4. **Document timeline** for the post-mortem.

**Day 1–7: Post-mortem + close the gap**

1. Write the post-mortem (per [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md) discipline).
2. Identify root cause: how did the secret end up where it leaked?
3. Action items to prevent recurrence (see "Closing the gap" below).
4. Verify rotation is complete (no consumers still using old secret).
5. Audit-log the full incident with timeline + decisions.

### Secret-specific rotation playbook

**Database password**:

1. Generate new password in vault.
2. Set new password on DB user (some DBs support multi-password during transition).
3. Push new password to all app consumers (deploy / restart).
4. Revoke the old password.
5. Flush long-lived DB sessions if applicable.

**API key (provider-managed)**:

1. Create new key via provider dashboard / API.
2. Update vault.
3. Push to consumers.
4. Revoke old key in provider dashboard.
5. Audit-log; check provider audit logs for old-key usage post-leak.

**OAuth token**:

1. Revoke at provider (call revoke endpoint).
2. Re-authenticate the connector (user flow).
3. Update vault with new token.
4. Refresh token also typically rotates.

**Cryptographic signing key**:

This is the hardest case. Steps:

1. Generate new keypair.
2. Publish revocation of old key (PGP keyserver, sigstore, etc.).
3. Re-sign current artefacts with new key.
4. Update consumers' trust roots.
5. Old key is now untrusted; any signature created with it is suspect.
6. **For audit-ledger signing key**: re-anchor; document the rotation in the ledger itself.

**Vault sealer key (KEK)**:

1. Generate new KEK in KMS / HSM.
2. Re-wrap every DEK with the new KEK (per [`vault-pattern.md`](./vault-pattern.md)).
3. Switch operational KEK to new.
4. After dual-read window, retire old KEK.
5. Audit-log.

**Session signing key**:

1. Generate new session key.
2. Servers sign new sessions with new key.
3. Servers continue to verify with both old + new for the session-lifetime window.
4. After window, retire old key.
5. Existing sessions degrade gracefully (logout + re-login).

### "Was anything stolen?" investigation

Pull access logs for the exposure window:

- **Unusual IPs**: requests from unexpected geos.
- **Unusual times**: spikes at 3 AM in your customer's geo.
- **Unusual patterns**: scraping; pagination through full data; bulk export.
- **Privilege ladder**: did access pattern climb (read → write → admin)?

For each anomaly: investigate, document, decide if it justifies customer disclosure.

Honest investigation matters more than convenient conclusion. If you can't tell whether data was stolen, say so — both internally and (when applicable) externally.

### Customer disclosure

Triggers requiring disclosure:

- PII potentially accessed (GDPR / LGPD / state-law thresholds).
- Payment data potentially accessed (PCI-DSS).
- Customer-by-name credentials leaked (compromised credentials notice).

Disclosure shape:

- What happened, in plain language.
- What data was potentially exposed (be specific).
- What you've done to contain (rotation, revocation, additional monitoring).
- What customers should do (rotate their side, watch for phishing, change passwords).
- Contact for questions (security@\<domain\>).

Avoid:

- Minimising language ("a small incident").
- Blaming a single person.
- Withholding information that emerges later.

Legal usually reviews disclosure. Pre-draft a template; iterate during incident.

### Regulatory timers

- **GDPR**: 72h to notify supervisory authority if personal data breach. Notify affected individuals "without undue delay" if high risk to rights/freedoms.
- **LGPD**: similar to GDPR; specific Brazilian DPA thresholds.
- **HIPAA**: 60-day notification for breaches > 500 individuals.
- **State / local laws**: California (CCPA), New York SHIELD, others — each with timelines.

Track applicable regulations per the markets you serve.

### Closing the gap

After rotation, address the leak vector:

| Vector | Mitigation |
|---|---|
| Secret in source code | Gate: `check-secrets` (see [`../../scripts/check-secrets.example.mjs`](../../scripts/check-secrets.example.mjs)) |
| Secret in `.env` committed | Pre-commit hook; `.gitignore` enforcement; secret-scan in CI |
| Secret in log line | Logger redaction (see [`vault-pattern.md`](./vault-pattern.md)) |
| Secret in screenshot | Awareness training; mask sensitive UI in dev tools |
| Secret in CI log | Mask in CI runner; verify before adding to env |
| Secret in chat / ticket | Team training; auto-DLP scanning of chat |
| Secret in error response | Error serializer never includes secrets / internals |

Pick the specific vector; ship the specific gate.

### Practice drills

Run a leak-rotation drill quarterly:

1. Pick a non-critical secret.
2. Simulate exposure.
3. Run the playbook end-to-end.
4. Time it; identify slow steps.
5. Refine.

A drilled rotation is fast. An undrilled rotation panics.

### Common failure modes

- **Delete-then-claim-resolved**. Pushing a follow-up commit that removes the secret. The secret is still in git history; still in any clone. → Rotate first. Cleanup is hygiene.
- **Rotate only at the vault**. Forget to revoke at the issuer. Attackers still authenticate. → Revoke at issuer; that's the kill.
- **Rotate one consumer; forget another**. Service A on new key; service B still using old. → Inventory all consumers before rotation; verify all switched.
- **Slow comms**. Internal team finds out via Twitter. → Internal first; then customer if applicable.
- **Blame the engineer**. They committed the secret. → Blameless; the gate that should have caught it didn't.
- **No post-mortem**. Same leak class recurs. → Post-mortem mandatory; action items tracked.
- **Force-push to "fix" history**. Removes from main but not from forks / mirrors / caches. → Rotate; do not rely on history scrub for safety.

### See also

- [`vault-pattern.md`](./vault-pattern.md) — sealed-vault + rotation primitives.
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — the leak event itself audit-logged.
- [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md) — paging path; post-mortem discipline.
- [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md) — adjacent: dependency-side leaks.
- [`../../scripts/check-secrets.example.mjs`](../../scripts/check-secrets.example.mjs) — the gate that should catch source-code leaks.

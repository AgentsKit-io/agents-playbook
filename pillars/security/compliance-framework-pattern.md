# Compliance Framework Pattern

How to map SOC 2 / ISO 27001 / GDPR / HIPAA controls onto your codebase + ops, so audits are evidence-driven, not theatre.

## TL;DR (human)

Compliance frameworks are catalogs of controls. Each control is "the system must do X" + "show evidence". Don't build special compliance machinery — instead, design the system so the controls are natural outputs of normal practice. The audit becomes "show me the dashboards / runbooks / logs / runbooks that already exist" — not "build a binder for the auditor".

## For agents

### The frameworks (overview)

| Framework | Scope | Audience |
|---|---|---|
| **SOC 2** | Operational + security controls | US enterprise sales |
| **ISO 27001** | Information security management system | International enterprise; broader than SOC 2 |
| **ISO 27017 / 27018** | Cloud-specific add-ons to 27001 | Cloud-heavy products |
| **GDPR** | EU personal data | EU users / data |
| **LGPD** | Brazilian personal data | Brazilian users / data |
| **CCPA / CPRA** | California consumer privacy | California residents |
| **HIPAA** | US health information | Healthcare data |
| **PCI-DSS** | Payment card data | If you touch card numbers |
| **FedRAMP / IL2-5** | US federal | US government customers |
| **NIS2** | EU critical infrastructure | EU "essential entities" |

Most B2B SaaS pursues **SOC 2 Type II** first; **ISO 27001** for international expansion; **GDPR / LGPD / CCPA** for global users.

### The Five Trust Service Criteria (SOC 2)

| Criterion | Plain English |
|---|---|
| **Security** | The system is protected against unauthorized access. (Required.) |
| **Availability** | The system is available for use as committed. |
| **Processing Integrity** | The system processes data accurately and completely. |
| **Confidentiality** | Confidential data is protected. |
| **Privacy** | Personal information is protected per stated policies. |

Pick Security + the ones relevant to your contracts. Most B2B do Security + Availability + Confidentiality.

### Type I vs Type II

- **Type I**: snapshot. "The controls were designed correctly at this date." Cheaper, faster.
- **Type II**: 6-12 month observation period. "The controls operated effectively over time." What enterprise buyers actually want.

Most products end up at Type II.

### Map controls to existing practices

The trick: most of the controls are things this playbook already prescribes. Examples:

| Control area | Already covered by |
|---|---|
| Access control | [`rbac-pattern.md`](./rbac-pattern.md), [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md) |
| Audit logging | [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) |
| Encryption at rest / in transit | [`vault-pattern.md`](./vault-pattern.md), TLS in transit (table-stakes) |
| Vulnerability management | [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md) |
| Vendor management | [`dependency-hygiene-pattern.md`](./dependency-hygiene-pattern.md) for software; separate process for SaaS vendors |
| Backup + recovery | [`../../phases/06-operate/README.md`](../../phases/06-operate/README.md) |
| Change management | [`../architecture/adr-pattern.md`](../architecture/adr-pattern.md), [`../architecture/rfc-pattern.md`](../architecture/rfc-pattern.md), [`../governance/pr-intent-pattern.md`](../governance/pr-intent-pattern.md) |
| Incident response | [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md) |
| Risk assessment | [`threat-model-template.md`](./threat-model-template.md) |
| Asset management | Repo + IaC inventory |
| Personnel security | HR-side; background checks; offboarding |
| Physical security | Cloud provider's certification covers data center |
| Data classification | [`data-classification-pattern.md`](./data-classification-pattern.md) |
| Tenant isolation | [`multi-tenant-isolation-pattern.md`](./multi-tenant-isolation-pattern.md) |
| Privacy / DSAR | [`data-classification-pattern.md`](./data-classification-pattern.md) |
| Secure SDLC | This playbook in its entirety |

When you build the system per the playbook, you implement most controls naturally. Compliance becomes documentation, not engineering.

### Evidence as a natural artifact

Auditors ask for evidence of controls. Examples of what they accept:

- **Code review evidence**: PR with manifest + reviewer approval (per [`../governance/pr-intent-pattern.md`](../governance/pr-intent-pattern.md)).
- **Access review evidence**: quarterly RBAC review record + signed audit-ledger entries.
- **Vulnerability triage**: Snyk / Dependabot / triage tickets + closure timestamps.
- **Backup verification**: quarterly restore-drill report.
- **Incident response**: post-mortem documents (per [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md)).
- **Change management**: ADR / RFC + PR-intent for every meaningful change.
- **Encryption**: KMS configuration + vault audit-log of key rotations.
- **Monitoring**: dashboard screenshots + on-call response records.
- **Training**: completion records for security awareness training.

If you have to *invent* the evidence at audit time, the control isn't real. The control is real when the evidence already exists in normal operations.

### Quarterly access review

A specific, recurring compliance ritual:

1. Pull all role assignments + per-user capability lists.
2. Per team / per system owner: review the list.
3. Confirm each access is still appropriate.
4. Revoke what isn't (employees rotated out; projects ended; over-grants).
5. Document the review (audit-log; signed approval).

A system that makes this easy:

- RBAC store query produces the list.
- Stale-grant detection (no use in N days) flags candidates.
- Bulk revocation is a single command.
- Audit-ledger records the review.

### Vendor management

Compliance frameworks require:

- Inventory of all third-party vendors / SaaS in your stack.
- Per-vendor risk assessment (what data do they touch? what cert do they hold?).
- Vendor SOC 2 / ISO copy on file.
- Annual review.
- Off-boarding procedure when a vendor is removed.

Maintain a vendor registry doc. Update as part of normal onboarding when adding a new service.

### GDPR + LGPD + CCPA specifics

Common requirements:

| Right | How |
|---|---|
| **Right to access** (data subject sees what's stored) | DSAR export tooling per [`data-classification-pattern.md`](./data-classification-pattern.md) |
| **Right to erasure** ("forget me") | DSAR delete; signed proof of completion |
| **Right to rectification** | Editable per-field via product UI |
| **Right to data portability** | Export in a structured, machine-readable format |
| **Right to object** | Consent management; opt-out flows |
| **Breach notification** | 72h timer (GDPR); incident response includes legal notification (per [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md)) |
| **DPO appointment** | Required for some scopes; document the role |
| **Privacy policy** | User-facing; matches actual practice |
| **DPA (Data Processing Agreement)** | Contract template; signed with B2B customers |
| **Cross-border transfer** | SCCs (Standard Contractual Clauses) or equivalent for non-EU transfers |

GDPR / LGPD / CCPA overlap significantly. One implementation usually satisfies multiple.

### Cookie consent (where applicable)

For user-facing web:

- Strictly-necessary cookies don't need consent.
- Analytics / marketing cookies require explicit opt-in (EU) or opt-out (CA).
- Banner: granular toggles; respects user choice; persisted.

Avoid: dark patterns ("Accept all" prominent vs "Reject" hidden); pre-checked boxes; "consent or leave" walls outside legal grounds.

### HIPAA-specific (if you touch PHI)

- BAA (Business Associate Agreement) with cloud provider mandatory.
- Encryption at rest mandatory (no exceptions).
- Access logging per PHI access — beyond regular audit.
- Minimum necessary access — capability scoped tightly.
- Workforce training records.
- Annual risk assessment.

HIPAA scope creeps; carefully boundary which features touch PHI and which don't. A non-PHI feature that touches PHI mistakenly drags the whole product into scope.

### PCI-DSS (if you touch card numbers)

Most products **don't store cards** — tokenise via Stripe / Braintree / Adyen. Your scope is the integration layer.

If you actually store card data, the scope is enormous (network segmentation, quarterly scans, annual audits, restricted personnel). Almost never worth it; use a tokeniser.

### The auditor relationship

Auditors are not the enemy. They:

- Want to confirm controls work; not find faults.
- Accept reasonable evidence (no need to invent paperwork).
- Tell you up front what they need.

Conventions that help:

- A dedicated **compliance lead** (engineer + ops + legal triangle).
- Quarterly internal pre-audit (run the same questions; close gaps).
- Evidence in a shared drive with structure that maps to controls.
- Engineers respond to specific questions from the auditor; not "do anything they ask".

### Common failure modes

- **Compliance as a separate practice**. Engineering builds; compliance bolts on. Slow + brittle. → Build controls into normal practice.
- **Evidence theater**. Generating documents at audit time that no one ever uses. → Evidence as natural artifacts.
- **No quarterly access review**. Auditor asks; you scramble. → Schedule + tool.
- **Privacy policy ≠ actual practice**. The policy says one thing; the code does another. → Policy reflects code; both reviewed together.
- **GDPR DSAR runs as an ad-hoc script**. Slow + error-prone. → Tooling per [`data-classification-pattern.md`](./data-classification-pattern.md).
- **PCI / HIPAA scope creep**. One feature drags rest of product into scope. → Boundary deliberately.
- **Vendor SOC 2 expired**. Audit fail. → Annual review with calendar reminders.

### Adoption path

1. **Day 0**: this playbook's practices in place; no compliance "program" yet.
2. **Pre-audit**: select framework (typically SOC 2 first); gap-assess.
3. **Engagement**: hire auditor; lead time 3-6 months.
4. **Observation period** (Type II): 6 months minimum; evidence collected continuously.
5. **Audit report**: typically completes 6-9 months after engagement starts.
6. **Maintenance**: annual re-audit; continuous evidence.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Evidence collection automation | Vanta, Drata, Secureframe, Tugboat Logic |
| Policy management | Vanta, Drata, in-house markdown |
| Vendor management | OneTrust, Whistic, in-house registry |
| GDPR DSAR | OneTrust, in-house DSAR tooling per data-classification |
| Cookie consent | OneTrust, Osano, Cookiebot, in-house |
| Audit firm | Big-4 (Deloitte, PwC, EY, KPMG), Big SOC firms (A-LIGN, Schellman), boutique |

### See also

- [`rbac-pattern.md`](./rbac-pattern.md), [`vault-pattern.md`](./vault-pattern.md), [`audit-ledger-pattern.md`](./audit-ledger-pattern.md)
- [`vulnerability-mgmt-pattern.md`](./vulnerability-mgmt-pattern.md), [`dependency-hygiene-pattern.md`](./dependency-hygiene-pattern.md)
- [`data-classification-pattern.md`](./data-classification-pattern.md), [`multi-tenant-isolation-pattern.md`](./multi-tenant-isolation-pattern.md)
- [`on-call-rotation-pattern.md`](./on-call-rotation-pattern.md), [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md)
- [`threat-model-template.md`](./threat-model-template.md)
- [`../../phases/06-operate/README.md`](../../phases/06-operate/README.md) — operate phase covers most compliance rituals.

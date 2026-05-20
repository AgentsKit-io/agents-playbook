---
title: "Session Management Pattern"
description: "How to model + protect user sessions — login state, refresh, revocation, idle expiry, device binding."
---

# Session Management Pattern

How to model + protect user sessions — login state, refresh, revocation, idle expiry, device binding.

## TL;DR (human)

Sessions are how a user proves identity over time. Three knobs: where the session lives (cookie vs token), how long (idle + absolute timeout), and how it's revocable (server-side store vs stateless JWT). Each combination has trade-offs. For high-stakes products (banking, admin): server-side, short-lived, revocable. For consumer: longer, stateless OK with shorter idle.

## For agents

### Three session storage models

| Model | Storage | Revocation | Stateless? |
|---|---|---|---|
| **Server-side session** | DB / Redis; cookie holds an opaque id | Server deletes record | No |
| **Signed JWT** | Token holds claims; server verifies signature | Hard (until expiry) | Yes |
| **Hybrid** | JWT short-lived; refresh token server-side | Refresh revocable | Mixed |

**Default**: hybrid. Short-lived access JWTs (15-60 min); long-lived server-side refresh tokens (days-months); refresh tokens revocable on logout / compromise.

### Why not pure JWT

Pure JWT (no server store):

- Stateless = scales horizontally.
- Cannot revoke before expiry without a denylist (which defeats statelessness).
- Permissions captured at issuance; promotion / demotion mid-session not reflected until expiry.

For most products, the trade-off is wrong. Hybrid keeps statelessness for the hot path (access token) and revocability for the cold path (refresh).

### Cookie vs Authorization header

| | Cookie | Authorization header |
|---|---|---|
| Browser apps | Standard | Requires explicit handling |
| Mobile / CLI apps | Awkward | Standard |
| CSRF risk | Yes (cookies sent automatically) | No |
| XSS risk (token theft) | Lower with `HttpOnly` | Higher |
| Cross-origin | CORS + `SameSite` configuration | Standard |

**Web app**: HttpOnly + Secure + SameSite=Lax cookies. CSRF protection via double-submit or origin header.

**Mobile / API**: Authorization: Bearer \<token\>. Token in secure storage (Keychain / Keystore).

**Both**: typical for products with web + mobile.

### Cookie flags

```
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...
```

- **HttpOnly**: JS can't read; XSS doesn't steal.
- **Secure**: HTTPS only; never in plaintext.
- **SameSite=Lax** (or Strict for stricter): CSRF mitigation.
- **Path**: scope.
- **Max-Age** / **Expires**: lifetime.

### Lifetime tuning

| Setting | Default | High-stakes |
|---|---|---|
| Access token | 15-60 min | 5-15 min |
| Refresh token (idle) | 30 days | 1-7 days |
| Refresh token (absolute) | 90 days | 30 days |
| Idle timeout (no activity) | 30 days | 30 min |
| Step-up reauth (sensitive ops) | 10 min after action | 10 min |

Display "last login" + active session list in UI. Let users revoke.

### Refresh flow

```
1. Client has access (expired) + refresh (valid).
2. Client → POST /auth/refresh, body: {refreshToken}.
3. Server verifies refresh in store; rotates refresh; issues new access.
4. Client stores new access + new refresh.
5. Continue.
```

**Rotation**: each refresh issues a new refresh token; old one invalidated. Catches reuse:

```
If a previously-issued refresh token is presented after rotation,
the entire token family is revoked (suspected compromise).
```

### Revocation paths

- **Logout**: delete session from server-side store; cookie expires.
- **Forced revoke**: admin tooling revokes by user / session / device.
- **Password change**: invalidate all sessions for that user.
- **Suspicious activity detected**: same.
- **Concurrent session limit**: oldest session evicted (or new login blocked, with comms).

### Device binding

Each session knows which device:

- User-agent + IP at issuance.
- Optional device-id (fingerprint or explicit registration).

UI surface: "Active sessions" with device + location + last activity, plus per-session revoke.

When a session is used from a new location / device: notify the user (email / app notification). Out-of-band confirmation for very sensitive operations.

### Step-up authentication

For sensitive actions (password change, payment, admin operations):

- Re-prompt for password / 2FA even if session is valid.
- Token "step-up" stamp valid for short window (5-15 min).
- Session NOT elevated permanently — step-up is per-operation.

Step-up is the difference between "logged in" and "authorised to do X right now".

### Single sign-on (SSO)

Enterprise customers expect SSO:

- **SAML**: enterprise IdPs (Okta, Azure AD, OneLogin).
- **OIDC**: modern; OAuth-derived; supports SAML use cases.
- **SCIM**: complementary; provisioning + deprovisioning.

Implementation:

- Use a vetted library (do not hand-roll SAML).
- IdP-initiated + SP-initiated flows both supported.
- JIT (just-in-time) provisioning: first SSO login creates user.
- Group → role mapping configured per tenant.

When user is deprovisioned in IdP: SCIM webhook revokes their sessions.

### Session storage

Server-side sessions (Redis is common):

- Key: session id.
- Value: user id + metadata + permissions snapshot + expiry.
- TTL: refresh token lifetime.

Scaling:

- Redis Cluster.
- Per-region for multi-region (per [`../architecture/multi-region-pattern.md`](../architecture/multi-region-pattern.md)).
- TTL handles cleanup; no separate sweep.

### CSRF protection

Even with `SameSite=Lax`:

- Double-submit cookie: server sends a CSRF token in both a cookie and the page; verifies they match on POST.
- Origin / Referer header check (lightweight; less compatible).
- Custom header pattern: same-origin XHR sends `X-Requested-With`; CORS prevents cross-origin from sending it.

Modern frameworks (Next.js, SvelteKit) ship CSRF middleware. Don't hand-roll.

### Common failure modes

- **Pure JWT for sensitive product**. Can't revoke; permission changes don't propagate. → Hybrid.
- **Long-lived JWT in cookie**. XSS = forever compromised. → Short access + revocable refresh.
- **Refresh reuse without family revoke**. Stolen refresh works forever. → Family-revoke on reuse.
- **No step-up**. Long-running session changes a password without re-auth. → Step-up.
- **SSO without SCIM**. Deprovisioned IdP user still has live sessions. → SCIM hook revokes.
- **Sessions never expire idle**. Stolen laptop = forever access. → Idle timeout.
- **Concurrent session limit not enforced**. One credential, infinite sessions. → Limit + comms.
- **Mobile app stores tokens in plain shared prefs / localStorage**. Stolen device = stolen token. → Secure enclave / Keychain.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Auth library | Auth.js / NextAuth, Clerk, Supabase Auth, Auth0, Cognito |
| Session store | Redis, DynamoDB, Postgres |
| SSO (SAML) | passport-saml, @node-saml/passport-saml |
| SSO (OIDC) | openid-client |
| SCIM | scim-patch, vendor-supplied |
| Token rotation library | jose (Node), pyjwt + custom rotation |

### See also

- [`vault-pattern.md`](./vault-pattern.md) — session-signing key rotation.
- [`rbac-pattern.md`](./rbac-pattern.md) — capability at session-issue time.
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — session events logged.
- [`secrets-leak-postmortem-playbook.md`](./secrets-leak-postmortem-playbook.md) — session signing-key rotation.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — session metrics.

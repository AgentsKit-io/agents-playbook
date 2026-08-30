# ADR-0010: Optional Docker sandbox runtime

## Status

Accepted

## Context

The process runtime bounds execution but does not isolate an agent tool from
the host. Coding tasks sometimes need a stronger boundary while the harness
must remain portable and must not require Docker for its core API.

## Decision

Expose `createDockerToolRuntime` as an optional provider built on the existing
process runtime. Each tool declares a fixed image and argv; the provider never
constructs or invokes a shell. By default it uses a cached image only, disables
container networking, makes the root filesystem read-only, drops Linux
capabilities, enables `no-new-privileges`, runs as an unprivileged UID, and
applies PIDs, memory, CPU, timeout, and output limits. Host mounts are absent
unless explicitly declared and default to read-only.

## Consequences

- Consumers without Docker can keep using the portable process or in-process
  providers; Docker failures are structured runtime failures.
- A Docker image is a trust boundary input and should be pinned by consumers
  when reproducibility matters. `pull: 'never'` prevents an implicit network
  fetch by default.
- The provider is not a VM or a guarantee against a compromised Docker daemon.
  Stronger VM, rootless, Windows, and remote sandbox providers can implement
  the same `ToolRuntime` seam later without changing the kernel.

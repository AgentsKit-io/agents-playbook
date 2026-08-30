# ADR-0031: Real-provider baseline before efficacy claims

## Decision

Collect the baseline by running the existing AgentsKit OS coding benchmark on
disposable, git-initialized copies of its fixture workspace. Record one report
per manifest task with provider output, duration, validation command, criterion
evidence, and the pinned source revision.

The baseline runner is separate from verification. Verification validates
recorded observations; it does not invoke a paid or nondeterministic provider on
every harness run.

## Measurement rule

Baseline data is not comparable by itself. A directional improvement requires
the same task, scope, provider conditions, acceptance evidence, and a completed
harness run. Missing harness-equivalent runs remain `comparableTaskCount: 0`.

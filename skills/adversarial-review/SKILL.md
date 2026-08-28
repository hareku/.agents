---
name: adversarial-review
description: Run a read-only adversarial review of Git changes in a background subagent, then independently validate every finding in the parent session. Use only when explicitly invoked for a challenge review of a working tree or branch diff.
---

# Adversarial Review

Run a two-stage, review-only workflow:

1. Delegate a skeptical review to one background subagent.
2. Keep the parent turn active, wait for the reviewer, and independently adjudicate its result in
   the parent session.

Do not modify files, apply patches, create commits, push branches, or start fixing findings during
this workflow. The parent adjudication must not be delegated.

## Parse the invocation

Accept this invocation tail:

```text
[--base <ref>] [--scope auto|working-tree|branch] [focus ...]
```

- Default `--scope` to `auto`.
- Treat `--base <ref>` as an explicit branch target. It takes precedence over `--scope`.
- Preserve all remaining text as the review focus without weakening or rewriting it.
- Reject a missing `--base` or `--scope` value, repeated options with different values, and an
  unsupported scope.
- `--scope staged` and `--scope unstaged` are unsupported.
- `--background` and `--wait` are unsupported. If either appears, do not start a subagent; explain
  that this skill always runs its reviewer in the background and show the supported invocation.

## Resolve the target

Use read-only Git commands from the user's current working directory. Stop with a clear error if it
is not inside a Git repository.

Resolve the review target before spawning the reviewer:

- With `--base <ref>`, review the current `HEAD` against that ref from their merge base.
- With `--scope working-tree`, review staged, unstaged, and untracked changes, even if that explicit
  scope is currently empty.
- With `--scope branch`, detect the base branch as described below.
- With `--scope auto`, use the working tree when
  `git status --short --untracked-files=all` is non-empty; otherwise use the detected base branch.

Detect the base branch in this order:

1. Resolve `refs/remotes/origin/HEAD` and use the referenced remote branch.
2. Try `main`, `master`, and `trunk` in that order, preferring each local branch before
   `origin/<name>`.
3. If none resolves, stop and ask for `--base <ref>` or `--scope working-tree`.

For a branch review, verify that the base ref and merge base resolve before spawning. The review
range is `git diff <merge-base>..HEAD`, not a direct two-dot diff from the base tip.

## Start the reviewer

Read [references/reviewer.md](references/reviewer.md), then spawn exactly one background subagent.
Give it:

- the repository root and resolved target, including the merge-base SHA for a branch review;
- the user's focus text verbatim, or `No extra focus provided.`;
- the absolute path to `references/reviewer.md`, with instructions to read and follow it;
- an explicit instruction not to invoke this skill, delegate again, or modify the repository.

Use an inherited-context subagent and do not override its model or reasoning effort. Name or label
the task `adversarial_review` when the agent interface supports labels.

After spawning, tell the user briefly that the adversarial review is running in the background and
that `/agent` can inspect its progress. This is a progress update, not the final response. Do not
end the parent turn while the reviewer is running. Wait for its completion using the available
agent-wait mechanism, while keeping any required progress updates concise.

If the subagent fails or is cancelled, report that state and the available error evidence. Do not
invent or reconstruct a review result.

## Adjudicate in the parent session

When the reviewer finishes, evaluate its result yourself in the parent session. Do not ask another
subagent to perform or assist with this step.

Re-open the target diff and enough surrounding code to verify every finding. Inspect relevant call
sites, invariants, configuration, and tests when they materially affect the claim. For each finding,
choose exactly one classification:

- `Valid`: the code supports the claimed failure path and material impact.
- `Partially valid`: a real risk exists, but the trigger, impact, severity, or recommendation is
  materially overstated or inaccurate.
- `Invalid`: the claim conflicts with the code, is pre-existing, is intentional, or lacks actionable
  evidence.
- `Unverifiable`: the available repository evidence cannot settle the claim.

Do not treat the reviewer report as evidence by itself. Cite the parent session's own file and line
evidence, correct overstated claims, and explain rejected findings. Reassess severity for every
valid or partially valid finding.

If the reviewer reports no findings, independently inspect the highest-risk changed paths and the
main design assumptions before accepting that result. If this check reveals a material omission,
report it as a parent-added finding and mark the reviewer result accordingly.

Derive the final verdict only from findings the parent classifies as `Valid` or `Partially valid`,
plus any parent-added material finding:

- `needs-attention` when at least one material risk remains;
- `approve` when no material risk is supported by the available evidence.

This is still review-only. Recommendations may describe what should change, but do not make the
change or imply that a fix is about to be applied.

## Return the final result

Follow applicable `AGENTS.md` instructions and the user's language preference. Return:

1. The resolved target and parent session's final verdict.
2. The reviewer's ship/no-ship summary and an overall assessment of whether its result was valid.
3. Every reviewer finding, ordered by the parent's reassessed severity, with:
   - the reviewer's claim;
   - the parent's classification;
   - parent-verified file and line evidence;
   - any corrected risk statement or severity;
   - the recommendation when the finding remains material.
4. Any parent-added finding.
5. Unverifiable items and residual risks.

When there are no reviewer or parent-added findings, say so directly and summarize the high-risk
paths the parent checked. Keep the final answer concise without hiding disagreement between the
reviewer and parent session.

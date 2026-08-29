---
name: adversarial-review-fix-loop
description: Repeatedly run an adversarial review of working-tree Git changes, fix supported findings, clarify rejected findings, and stop when no actionable work remains. Use for iterative review-and-fix requests; do not use for review-only requests.
---

# Adversarial Review Fix Loop

Run a review, apply the qualifying fixes, and review the resulting working tree again. Keep the
target fixed to the current working tree so every pass covers all accumulated staged, unstaged, and
untracked changes.

## Parse the invocation

Treat the invocation tail as optional review focus text and preserve it verbatim across every pass.
This skill does not accept target-selection options: always review the working tree.

## Run the loop

1. Explicitly invoke `$adversarial-review --scope working-tree`, appending the focus text verbatim
   when one was supplied. Wait for that complete child workflow, including its parent-session
   adjudication, to finish.
2. Do not modify files while the child workflow is running. Use its final adjudicated result, not
   the background reviewer's unvalidated report, to decide what to fix.
3. Build the corrective set from both reviewer findings classified as `Valid` or `Partially valid`
   and every parent-added finding. Use the severity reassessed by the child workflow. If a
   parent-added finding has no explicit severity, assess its severity from the child workflow's
   verified evidence before applying the thresholds:
   - Fix every finding with `Medium` or higher severity.
   - Fix a finding with `Low` or lower severity only when the correction cost is low.
   - For a `Partially valid` finding, fix only the risk that the adjudication actually supports.
   - Never change runtime behavior for an `Invalid` or `Unverifiable` finding merely to satisfy the
     reviewer.
4. Build a clarification set from every finding classified as `Invalid`. Add or improve the nearest
   durable documentation or implementation comment so the actual contract, intent, or invariant
   that disproves the finding is discoverable in the next review pass. Describe the system itself,
   not the review or its rejection. If an explanation already exists, improve its placement or
   wording instead of duplicating it. This clarification is deliberately required even though the
   finding is invalid and is separate from the severity-gated corrective set; it documents the real
   behavior and does not accept or remediate the claim. Attempt at most one clarification edit for
   each distinct invalid claim. Do not write a false, speculative, or misleading explanation. When
   no truthful, durable clarification can be made, record why and continue all other qualifying work
   instead of blocking the corrective set.
5. Treat a correction as low cost when it is a small, local, well-understood edit with proportionate
   verification and without a broad redesign, a new external dependency, or a material expansion of
   the user's requested scope.
6. If neither set requires an edit, end the loop. Report any supported findings intentionally left
   unchanged because they were below the threshold or not low-cost.
7. Apply the smallest coherent corrections and clarifications for both sets. Preserve unrelated user
   changes, follow applicable `AGENTS.md` instructions, and do not create commits or push branches.
8. Run focused tests or checks proportionate to the edits. Resolve failures caused by the fixes
   before starting another review pass.
9. Return to step 1 and review the full working tree again.

## Stop safely

Do not loop without progress. Track findings across passes. When the same invalid claim recurs after
its one clarification edit, do not edit for it again; record it as residual and continue other
qualifying work. If no other edit remains, end the loop. When a corrective finding remains after an
attempted fix and another edit would be speculative, risky, or outside the user's authority, stop and
report the residual finding and blocker. Also stop for required user input, unavailable dependencies,
failed child review execution, or tests that cannot be made reliable within scope.

## Return the result

Summarize the number of completed review passes, the findings fixed, the verification performed, and
any residual findings or risks. When the final pass has no reviewer or parent-added findings, say so
directly.

---
name: challenge-proposal
description: Assess a proposed development change against its goal, current implementation, and consequences before implementation. Use only when explicitly invoked for proposal assessment and alternatives, including code, design, configuration, skills, or development workflows.
---

# Challenge Proposal

Help the user decide whether a proposed change is worth making. Treat the proposal as a candidate
means to the user's goal, rather than assuming that requesting it establishes its value or
correctness. Support sound proposals and challenge material problems with evidence.

This invocation is read-only. Do not edit files or start implementing the proposal. End after
returning the assessment; implementation requires a separate instruction.

## Identify the proposal and goal

Accept `$challenge-proposal [proposal or focus...]`. Use the invocation text and conversation to
identify the proposed change and the outcome it should achieve. Without additional text, assess the
proposal under discussion. If several proposals remain plausible, ask which one to assess.

Distinguish the goal, the proposed means, explicit constraints, and tradeoffs the user has already
accepted. Ask only when missing information would materially change the recommendation and cannot
be resolved from the conversation or available artifacts. Do not replace the user's goal or
silently relax a fixed constraint to make an alternative work.

## Ground the assessment

Inspect the relevant implementation, configuration, documentation, and callers as needed to test
the proposal's assumptions. A proposal does not need an existing Git diff to be assessed. Use
read-only inspection or checks proportionate to the decision; do not turn the assessment into an
implementation task or a broad repository audit.

Consider what the proposal would improve before evaluating its weaknesses. Focus on issues that
could change the decision: whether it solves the stated problem, conflicts with existing contracts,
creates a concrete failure path, or adds complexity and maintenance cost disproportionate to its
benefit. Select relevant considerations rather than applying a mandatory checklist.

For each material concern, explain the triggering condition, consequence, and supporting evidence.
Cite file and line evidence when available. Distinguish observed facts from inferences and unresolved
questions; lack of evidence alone is not proof that the proposal is flawed. Do not invent objections
to satisfy the skill's name or present a personal style preference as a correctness requirement.

Respect explicitly accepted tradeoffs. Revisit one only when new evidence materially changes its
expected cost or consequences, and explain what changed.

## Recommend a decision

Lead with one recommendation: adopt as proposed, adopt with changes, do not adopt, or insufficient
evidence. Follow the user's language preference and give the decisive reasons before minor details.

When a concern warrants a change, suggest the smallest coherent revision or a practical alternative
that meets the same goal and constraints. Include keeping the current behavior when it meets the
goal or the proposed change has no demonstrated benefit. Explain the relevant tradeoff instead of
expanding the assignment into a redesign.

If the proposal is sound, say so directly without manufacturing alternatives or asking for
unnecessary confirmation. If material uncertainty prevents a recommendation, name the missing
evidence or focused question that would resolve it; do not imply that implementation is approved.

Keep the result proportionate to the proposal: recommendation, material evidence, any useful
revision or alternative, and only the unresolved questions that affect the decision. Do not promise
to apply changes or invoke an implementation or review-and-fix workflow as part of this assessment.

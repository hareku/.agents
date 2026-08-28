---
name: commit
description: Create one focused local Git commit from the intended working-tree changes. Use when the user asks to commit changes or invokes $commit; do not use for amend, rebase, push, tagging, or requests that only discuss commits.
---

# Commit

Create exactly one local commit containing the user's intended changes. Do not push it.

## Inspect the repository

From the user's current working directory:

1. Confirm it is a Git worktree and read the applicable `AGENTS.md` instructions.
2. Inspect `git status --short --branch`, the staged diff, the unstaged diff, untracked files,
   the current branch, and the subjects of the 10 most recent commits.
3. Stop and explain the problem if there are unresolved conflicts or no changes to commit.

Treat changes that were already staged as intended for the commit unless the user says otherwise.
Do not unstage or overwrite them. Include unstaged and untracked paths only when they clearly belong
to the same requested change. If unrelated changes exist, leave them untouched; ask the user only
when the intended commit boundary cannot be inferred safely.

Inspect a path before staging it. Do not stage likely secrets, credentials, generated artifacts, or
large binary files unless the user clearly intends to commit them.

## Create the commit

1. Stage the intended paths with explicit pathspecs.
2. Re-read `git status --short` and `git diff --cached` to verify the exact commit contents. Stop if
   the staged diff is empty or contains unintended changes.
3. Use the user's commit message when one was supplied. Otherwise, infer a concise message from the
   staged diff and follow the repository's recent commit style. Describe the change, not the process,
   and do not mention an AI or assistant.
4. Run one `git commit` without `--amend` or `--no-verify`.

Do not bypass hooks. If the commit fails, report the error and the resulting working-tree state
instead of retrying with weaker checks or creating a different commit.

After success, report the new commit hash and subject, plus any remaining uncommitted changes.

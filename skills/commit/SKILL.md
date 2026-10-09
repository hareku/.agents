---
name: commit
description: Create one focused Git commit from the intended working-tree changes, optionally pushing it when explicitly requested. Use when the user asks to commit changes or invokes $commit; do not use for amend, rebase, push-only requests, tagging, or requests that only discuss commits.
---

# Commit

Create exactly one local commit containing the user's intended changes. Push it only when enabled
by the user's request.

## Options

- `$commit`: create a local commit without pushing.
- `$commit --push`: create a local commit, then push the current branch after the commit succeeds.

An explicit natural-language request to commit and push also enables `--push`. A request to commit
alone does not. Honor any remote or destination branch explicitly supplied by the user.

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

## Push when requested

After the commit succeeds, perform these steps only when `--push` is enabled:

1. Resolve the destination from the user's explicit request, otherwise the current branch's
   configured upstream. If there is no upstream and exactly one remote, use that remote and the
   current branch name. Ask for the missing destination only when it cannot be inferred unambiguously;
   stop and explain if there is no usable remote or the checkout is detached.
2. Refresh the destination branch's remote state if it exists and inspect the outgoing commits,
   including any pre-existing local commits. If pushing would publish unrelated commits not clearly
   covered by the request, clarify the scope before pushing.
3. Run a normal push with an explicit remote and `HEAD:refs/heads/<destination-branch>` refspec so
   only the intended branch is pushed. Set the upstream with `--set-upstream` when the current branch
   has none. Do not force-push, push tags or other branches, or bypass hooks.

If destination inspection or the push fails, keep the successful local commit and report the error.
Do not reset or amend the commit, automatically pull or rebase, or retry with weaker checks.

## Report the result

Report the new commit hash and subject, plus any remaining uncommitted changes. When push was
requested, also report its destination and whether it succeeded or why it could not be completed.

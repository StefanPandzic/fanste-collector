---
name: implement-task
description: End-to-end workflow for one FC task from `tasks/`. Reads the task, drafts an implementation plan, asks the user about anything unclear or risky, and waits for the user to approve the plan. It then creates the `fc-XX-*` branch, implements the task, runs the `unit-test-writer` agent until the tests pass, runs the `code-reviewer` agent until the verdict is READY, and ends with a summary of what was done. Use it when the user asks to implement, start or work on a task such as "FC-07".
argument-hint: <task id, e.g. FC-07>
disable-model-invocation: true
---

# Implement a task

Task to implement: `$ARGUMENTS`

Work through the phases below in order. Don't skip a phase, and don't start a phase before the previous one is
finished. The two approval gates (phase 3 and phase 4) are hard stops: wait for the user's answer.

## 1. Find and read the task

1. Resolve the argument to a task file. `FC-07`, `fc-07`, `07` and `7` all mean `tasks/phase-*/07-*.md`. If the
   argument is empty, read `tasks/README.md`, suggest the first `TODO` task whose dependencies are all `DONE`, and
   ask the user to confirm it before going on.
2. Read the whole task file: Goal, Subtasks, Acceptance criteria and Notes.
3. Read `tasks/README.md`:
   - Check the task's status. If it's already `DONE` or `IN PROGRESS`, ask the user whether to continue.
   - Check the "Depends on" column. Every dependency that isn't `DONE` is an open question for phase 3.
4. Read the dependency task files too, when the task builds on what they deliver (types, packages, routes).

## 2. Research and draft the plan

1. Read the project rules: `CLAUDE.md`, plus `apps/web/CLAUDE.md` and/or `apps/desktop/CLAUDE.md` for every app the
   task touches (see the "Where to look" table in `CLAUDE.md`).
2. Explore the code the task changes or depends on. Find existing code to reuse, the files to change, and stubs that
   name this task (search for the task ID, e.g. `FC-07`). Use the `Explore` agent for wide searches.
3. The web app runs Next.js 16. Check `apps/web/node_modules/next/dist/docs/` before planning any Next.js API usage.
4. Draft the plan. It must contain:
   - **Summary:** what will be built, in two or three sentences.
   - **Steps:** ordered, each one mapped to the subtask(s) it covers, with the files it creates or changes.
   - **Placement:** which code goes in `packages/*` and which in the apps, following the architecture in `CLAUDE.md`.
   - **New dependencies, env vars and migrations**, if any. Env vars go in `.env.example`, tagged with the task ID.
   - **Manual steps for the user:** things you can't do yourself, such as creating a Supabase project, getting API
     keys or setting CI secrets.
   - **Out of scope:** subtasks or ideas you won't do, with the reason.
   - **Tests:** which modules will get unit tests.
   - **Acceptance criteria:** how each one will be met and checked.

## 3. Ask the open questions

Before you show the plan, collect everything you aren't sure about and ask it with `AskUserQuestion` (up to four
questions per call; ask again if there are more). Ask when:

- the task file is ambiguous, or contradicts the code or `CLAUDE.md`;
- there are several reasonable approaches with real trade-offs (library choice, data shape, where code lives);
- a choice could cause problems later: a hard-to-change schema or API contract, a security trade-off, something that
  blocks a future mobile app, or something that conflicts with a later task in `tasks/`;
- a dependency task isn't `DONE`;
- you need something from the user (credentials, accounts, a decision on scope).

Give each question concrete options, and put your recommendation first, marked "(Recommended)". Don't ask about
things you can decide from the code, the task file or the conventions. If there's nothing to ask, say so in one line
and go on.

Update the plan with the answers.

## 4. Get the plan approved

Show the full plan to the user in your message, then ask with `AskUserQuestion` whether to:

- **Approve**, and start the implementation;
- **Change** the plan (the user explains what in "Other" or the notes);
- **Cancel**.

If the user asks for changes, update the plan, show it again and ask again. Repeat until it's approved or cancelled.
Don't create a branch or edit any file before the plan is approved.

## 5. Create the branch

1. Run `git status --short`. If there are uncommitted changes, stop and ask the user what to do with them (commit,
   stash, or carry them over to the new branch). Never discard them yourself.
2. Create the branch from an up-to-date `main`. The name is `fc-` plus the task file's name, e.g.
   `tasks/phase-2-api-data/07-normalized-item-model.md` → `fc-07-normalized-item-model`:

   ```sh
   git checkout main
   git pull --ff-only
   git checkout -b fc-07-normalized-item-model
   ```

   If `git pull` fails (no network, diverged history), tell the user and ask before going on from the local `main`.
   If the branch already exists, ask whether to switch to it or pick another name.

3. Set the task's status to `IN PROGRESS` in `tasks/README.md`.

## 6. Implement

- Follow the approved plan step by step. Track the steps with a todo list.
- Follow `CLAUDE.md` and the app instructions: shared logic in `packages/*`, the import order, `import type`,
  stubs that name the task that will implement them, env vars in `.env.example`, and migrations for schema changes.
- Tick each subtask's checkbox in the task file when its work lands.
- If you hit something the plan didn't foresee and it changes the design, scope or a public contract, stop and ask
  the user. Small, local adjustments don't need a question, but list them in the final summary.
- When all steps are done, run `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` from the repo root and
  fix what fails.

## 7. Unit tests

1. Run the `unit-test-writer` agent (`.claude/agents/unit-test-writer.md`). Tell it which files and functions the
   task added or changed.
2. If it reports a bug in the code, tell the user (file, line, expected vs. actual), fix the code, and run the tests
   again. Never weaken a test to make it pass.
3. If it reports logic it couldn't test (e.g. logic inside an Electron module), decide with the user whether to move
   it into a pure module now.
4. Go on to the review only when all tests pass.

## 8. Code review

1. Run the `code-reviewer` agent (`.claude/agents/code-reviewer.md`). Tell it the task ID and the task file path. It
   reviews the whole branch, the new tests included, and runs format check, lint, typecheck and test.
2. Relay every 🔴 Security and 🟠 Bug finding to the user, in full, with file and line. Never drop or soften them.
3. Fix the findings:
   - Security, bug and architecture/structure findings: fix them, or explain to the user why one doesn't apply.
   - Minor findings: fix them when the fix is cheap and clearly right.
   - If a fix changes logic, update or add its tests so `pnpm test` still covers it.
4. Run the reviewer again after the fixes. Repeat until the verdict is **READY** and all four checks pass.
5. If the verdict is still NEEDS CHANGES after three rounds, stop and ask the user how to go on.

## 9. Finish

1. Check the task file against the plan: every done subtask is ticked, and every acceptance criterion is met or
   listed as open. Set the status in `tasks/README.md` to `DONE` only if all acceptance criteria are met; otherwise
   leave it `IN PROGRESS`.
2. Don't commit, push or open a PR unless the user asks for it.
3. End with a summary:
   - **Branch:** the branch name.
   - **What was done:** per plan step, the files created or changed.
   - **Deviations from the plan**, with the reason.
   - **Tests:** the test files added and what they cover.
   - **Review:** number of rounds, the final verdict, and the security and bug findings that were fixed.
   - **Checks:** format · lint · typecheck · test results.
   - **Acceptance criteria:** each one, met or open.
   - **Manual steps left for the user**, if any.
   - **Next step:** offer to commit and open the PR (`fc-XX-short-name`).

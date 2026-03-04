# AGENTS.md

## "Push to main" Means Merge To Local Main

- When the user says "push", interpret it as: merge the current work into local `main`
- Do not push to any remote unless the user explicitly asks to push to a remote.

## Detached HEAD: Best Practical Flow To Update Local `main` (only merge if user asks for it)

1. Commit your detached `HEAD` work first.
   - `git add -A && git commit -m "<message>"`
2. Switch to local `main` in the main worktree and ensure it is current.
   - `git checkout main`
   - `git pull --ff-only` (only when remote sync is explicitly needed)
3. Apply detached `HEAD` commit(s) onto local `main`.
   - Prefer: `git cherry-pick <detached-commit-sha>`
4. If conflicts occur, combine both sides manually (do not blindly use `--ours` or `--theirs`), then continue:
   - `git add <resolved-files>`
   - `git cherry-pick --continue`
5. Validate and finalize.
   - Run relevant tests/checks.
   - Keep "push" meaning merge to local `main` only, unless remote push is explicitly requested.

## Commit After Each Task

- Always create a commit after completing each discrete task or sub-task.
- Do not batch multiple tasks into a single commit.
- Each commit message should describe the specific change made.

## Completion Verification Requirement (MANDATORY)

- **ALWAYS test UI/behavior changes before reporting completion.** Never skip this step.
- After completing a task that changes behavior or UI, run a Playwright verification in headless mode.
- Start the dev server (`npm run dev`) if not already running, then open the page with Playwright CLI.
- For responsive/mobile changes, use `resize <w> <h>` to test at mobile (375x812) and tablet (768x1024) viewports.
- Before taking any screenshot, wait a few seconds to ensure the UI has fully loaded.
- Always capture a screenshot of the changed result and display that screenshot in chat when reporting completion.
- If the dev server fails to start due to pre-existing errors, fix them first or work around them before testing.

## Browser Automation: Prefer Playwright CLI Over Cursor Browser Tool

- For all browser interactions (navigation, clicking, typing, screenshots, snapshots), prefer the Playwright CLI skill in headless mode over the Cursor IDE browser MCP tool.
- Playwright CLI is faster, more reliable, and works in headless environments without a desktop.
- Use headless mode by default; only add `--headed` when a live visual check is explicitly needed.
- Skill location: `~/.codex/skills/playwright/SKILL.md` (wrapper script: `~/.codex/skills/playwright/scripts/playwright_cli.sh`).

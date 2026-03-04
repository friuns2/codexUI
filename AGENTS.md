# AGENTS.md

## "Push to main" Means Merge To Local Main

- When the user says "push", interpret it as: merge the current work into local `main`
- Do not push to any remote unless the user explicitly asks to push to a remote.

## Best Practical Flow For Worktree: Commit, Create Branch, Rebase, Merge To Local `main` (only merge if user asks for it)

1. In the worktree, commit changes and create a branch.
   - `git add -A && git commit -m "<message>"`
   - `git switch -c <your-branch>`
2. Rebase branch on latest `main`.
   - `git rebase main`
3. Resolve conflicts if any, then continue rebasing.
   - `git add <resolved-files>`
   - `git rebase --continue`
4. Merge into local `main` from the main worktree.
   - `git checkout main`
   - `git merge --ff-only <your-branch>`
5. If `--ff-only` fails (non-linear history), use:
   - `git merge --no-ff <your-branch>`
6. Keep "push" meaning merge to local `main` only, unless remote push is explicitly requested.

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

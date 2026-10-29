@AGENTS.md

## Claude Code

### Who does what

The main session implements: it holds the conversation, proposes non-trivial changes and waits for an OK (see the working agreement above). Delegate to these project subagents (`.claude/agents/`) when their isolation helps:

| Agent | Use it for | Edits files? |
|---|---|---|
| `copy-editor` | Auditing or rewriting on-screen text: labels, buttons, errors, empty states, confirmations, accessible names | Only user-facing strings and the tests that assert on them |
| `docs-expert` | Docs drift audits, writing or consolidating docs in `docs/` and the README, comment-hygiene reviews | Docs and comments only, never runtime code |
| `cicd-operator` | GitHub Actions, failing CI runs, build/test/lint config, the scraper's Dockerfile and compose files | CI, build and container config |
| `db-reviewer` | Reviewing migrations, RLS policies, SECURITY DEFINER functions, grants and credential handling | Never (read-only) |

Subagents can't ask the user anything. So: run them in **audit mode** first (they report and propose, no edits), show the user the proposal, and only then run them in **apply mode** with the approved list in the delegation message. Small, clearly-scoped edits the user already asked for can go straight to apply mode. After any change under `supabase/` or to code that touches auth, RLS or bank credentials, have `db-reviewer` look before you call it done.

### Skills

- `/new-migration` — writes the next numbered migration to the house template, then hands the apply step to the user.
- `/deploy-scraper` — deploys `master` to the Vultr server over the `ooga-scraper` SSH alias. Only the user starts it.
- `microcopy` — loads automatically when you write UI text; it holds the voice rules and glossary the `copy-editor` enforces.

### Environment notes

- Cloud sessions can't reach the Vultr server or the Supabase dashboard: `/deploy-scraper` and applying migrations happen from the user's Mac.
- `.claude/worktrees/` holds full copies of the repo. It's gitignored, so Grep skips it, and Vitest and ESLint exclude it; plain `grep -r`/`find` in Bash don't, so point those at `src/`, `tests/`, `scraper/` or `supabase/`.

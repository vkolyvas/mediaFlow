# Provenance

Vendored copy of [new-xp/ultrademo](https://github.com/new-xp/ultrademo) — demo video
pipeline (Playwright capture → TTS → Remotion render) driven by a project-local Claude Code skill.

## Pinned upstream

- Upstream commit: `e7bdcfc241600b65bf6536f2c3c990a00a765b2d`
- Tag: `audit-pass-e7bdcfc`
- Acquired: cloned from the audit sandbox copy, not from GitHub, so this repo provably
  starts at the audited ref.
- Upstream license: Apache-2.0

## Audit

Track A audit 2026-07-15 — **CONDITIONAL PASS**, valid for `e7bdcfc` only.
Full entry in the vault: `audit-registry.md`.

Notable: upstream self-attests "0/100 SAFE" via a committed SkillSpector baseline. The raw
scan is 100/CRITICAL/DO_NOT_INSTALL — the SAFE badge is entirely baseline-dependent. The
baseline was independently verified honest for this commit (all 36 findings walked to
file:line). That verification does not carry forward to any other commit.

## Standing constraints

1. **Never `git pull` upstream without re-auditing.** Upstream is young and
   single-contributor. To review a delta: `git fetch upstream && git diff e7bdcfc..upstream/main`.
   The `upstream` remote has its push URL set to `DISABLED` deliberately.
2. **The skill's freshness auto-fetch stays suppressed.** It offers a consented
   `git pull` on session start; declining is the default posture here.
3. **Remotion licensing.** Free tier covers for-profit orgs with <=3 employees.
   Some Luck Productions LLC qualifies. **Larger organizations do not** — never use this
   pipeline for a larger employer's assets without a purchased Remotion Company License.
4. **Human-review every `flow.mjs` before capture.** Flows are loaded via `await import()`
   as fully-privileged Node. An agent-authored flow is arbitrary code; read it first.
5. **`.profiles/` is for dedicated capture logins only.** Never point capture at a real
   Chrome profile. See finding F2 in the registry entry re: `realKeychain`.
6. **Skill stays project-local.** It lives in `.claude/skills/` here and nowhere else —
   not in `~/.claude/skills/user/`, not in claude-skills-src. That scopes its
   self-provisioning and freshness behavior to this repo. GitHub-runner use would require
   it committed project-local anyway.
7. **Supplying an ELEVENLABS_API_KEY intentionally egresses narration text** to
   api.elevenlabs.io. That is sanctioned, by design, and the only tool-attributable egress
   in normal operation besides Remotion's one-time headless-shell download
   (`www.remotion.dev` → `storage.googleapis.com`, expected per machine).

## Pilot

`projects/crapsai-simulator-2026-07-15-1045/` — Craps-AI public simulator, 60.5s MP4,
narrated with macOS `say`. Selectors validated. Reuse this flow as the ElevenLabs
quality test before targeting a new site.

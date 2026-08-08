# Contributing

For humans and AI agents alike. `CLAUDE.md` owns the tech stack, architecture
and code conventions; this file owns **how a change gets from your machine into
`main`**.

## The loop

Every change, however small, follows the same four steps.

### 1. Pull `main` first — before anything else

Start from what everyone else has already merged, not from whatever your working
copy happened to be on:

```bash
git switch main
git pull
```

Do this **at the start of every task**, not once a day. The cost of skipping it
is not a merge conflict at the end — it is an afternoon spent fixing a bug
somebody already fixed, or rewriting a helper that now exists two files over.

If `git pull` refuses because you have uncommitted work, that work belongs on a
branch: see step 2, then pull again.

### 2. Branch. Never commit to `main`

```bash
git switch -c fix/thing-that-was-broken
```

`main` is protected in practice even where it is not in configuration: it is
what deploys. Name the branch for the change, not for yourself —
`fix/…`, `feat/…`, `docs/…`, `chore/…`, `perf/…`.

**One branch, one concern.** If you notice something unrelated worth fixing,
finish what you are on, then branch again from a freshly pulled `main`. A PR
that removes a feature *and* redesigns an avatar is two PRs.

### 3. Verify before you open the PR

Both must be clean. Neither is optional:

```bash
npx tsc --noEmit
npm test
```

`npm test` needs a seeded database — the fixtures in `prisma/seed-data.ts` are
referenced by id from the tests, so an unseeded or stale database fails dozens
of them for reasons that have nothing to do with your change:

```bash
npm run db:seed
```

Run `npm run lint` too. Warnings are tolerated; errors are not.

If a build fails in a way that makes no sense, `rm -rf .next` and try again
before you believe it — a stale cache produces convincing phantom errors.

### 4. Open a PR and merge it

```bash
git push -u origin <branch>
gh pr create
gh pr merge <n> --merge --delete-branch
```

Commit `bun.lock` when it changes. Never commit `.idea/` or anything in
`generated/` — both are ignored on purpose.

## Writing the change

- **Read before you write.** Trace the actual flow through every file the change
  touches. The smallest diff in the wrong place is a second bug, not a fix.
- **Fix the root cause.** A report names a symptom. Grep every caller of the
  function you are about to edit — one guard in the shared function is a smaller
  diff than a guard in each caller, and it leaves no sibling still broken.
- **Reuse what is here.** A helper, type, or component that already exists beats
  a new one. Re-implementing what lives a few files over is the most common way
  this codebase gets worse.
- **HeroUI for UI.** Do not hand-roll a control that `@heroui/react` already
  covers, and do not add new files under `components/ui` beyond thin wrappers.
  See `CLAUDE.md`.
- **RTL and Persian-first.** User-facing copy and numerals are Persian; prefer
  `me-*`/`ms-*`/`start-*`/`end-*` over physical `left`/`right`.

## Commit messages

Conventional prefix, then a subject that says what changed for a *reader of the
product* rather than what you typed:

```
fix(workspace): the logo was two letters of the name, and the edit form saved nothing
```

The body explains **why**, and what you decided not to do. Diffs record the
what; only you can record the reasoning, and the next person to touch this code
will need it. AI agents: end the message with

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## For AI agents specifically

Everything above applies to you without exception. In particular:

1. **Pull `main` before you plan**, not after — a plan built on a stale tree is
   a stale plan.
2. **Never commit to `main`**, even when the user's request sounds urgent, and
   even when you are only "quickly checking something".
3. **Report faithfully.** If tests fail, say so and paste the output. If you
   skipped part of the scope, say which part and why. A confident summary of
   work that did not happen is worse than no summary.
4. **Ask before anything outward-facing** — pushing, opening or merging a PR,
   deleting a branch, or touching a deployment.

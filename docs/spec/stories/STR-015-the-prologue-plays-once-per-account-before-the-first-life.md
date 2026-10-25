**Title**
The prologue plays once per account, before the first life

**Status**: active

**Business Value**
Spiritbound's cosmology — three layers, the bond, and why a spirit holds
your cards when you die — is currently nowhere the player can meet it.
`docs/LORE.md` is for us; the tutorial zone teaches movement and combat,
not why any of it matters.
A recited prologue puts the whole mythology in
front of the player before they have a character to lose, and it buys two
mechanics their explanation for free: cards survive death because thought
was the first layer, and the spirit that holds them is a thing that chose
not to take a body.
It plays once because a creation myth you cannot skip
on your fourth character is a tax, not a prologue.

**Problem / Context**
Nothing in the client runs before `startLife`.
`GameScene` connects, and
its `onSubscribed` callback fires `startLife` immediately whenever the
account has no living character (`client/src/scenes/GameScene.ts` around
line 378) — there is no character-creation step and no pre-game surface at
all.
`accountProgress` already carries exactly the kind of flag this
needs: `tutorialCompleted` is account-scoped, server-held, and flips at
most once (`CON-033`).
The poem and its shot list exist as documents
(`docs/PROLOGUE.md`, `docs/PROLOGUE_SHOTLIST.md`) with no code that reads
them.

The flag has to live on the server.
Browser storage would replay the
prologue for the same account on a second device and lose it on a cache
clear, and the account identity is the only thing that survives both.

**Solution Approach**
A `prologueSeen` boolean joins `tutorialCompleted` on `account_progress`,
initialised `false` in `onConnect` alongside the rest of the row, and
flipped by a new `markPrologueSeen` reducer that the client calls on
either finish or skip.
The reducer is idempotent: the second call is a
no-op, not an error, because the client has two paths into it and a
resumed session may well take both.

Client-side, `GameScene` consults the subscribed `account_progress` row in
its existing `onSubscribed` callback.
If `prologueSeen` is false it
launches `PrologueScene` and **withholds** the automatic `startLife`
rather than racing it; the scene calls `markPrologueSeen` and then
`startLife` when it ends.
The death-overlay `RETURN` button's own
`startLife` call is untouched — that path belongs to an account that
necessarily has a life already.

The verse is **not** retyped into the code.
`client/src/prologueBeats.ts`
holds a flat beat manifest — plate id, shot size, lines, hold duration,
parallax factors — and a unit test asserts every line in it occurs in
`docs/PROLOGUE.md`, so an edit to the poem that misses the manifest fails
the suite instead of silently shipping a stale recitation.

**Acceptance Criteria**

- A fresh account's `account_progress` row is created with
  `prologueSeen: false`, and no existing field changes meaning.
- `markPrologueSeen` flips the flag to `true` for the calling identity;
  called a second time it returns normally and changes nothing.
- `markPrologueSeen` from an identity with no `account_progress` row
  fails with a `SenderError` rather than creating one — row creation
  stays `onConnect`'s job.
- An account with `prologueSeen: false` and no living character sees the
  prologue, and no character is created until the prologue ends.
- An account with `prologueSeen: true` and no living character goes
  straight to `startLife`, exactly as today.
- Dying and pressing `RETURN` never shows the prologue, whatever the
  flag says.
- Finishing the prologue and skipping it are indistinguishable to the
  server: both call `markPrologueSeen`, both then start the life.
- Every line of verse the manifest renders is present verbatim in
  `docs/PROLOGUE.md`.

**Out of scope**

- The generated plate art.
  The scene renders placeholders keyed by plate
  id; dropping real images in later is an asset change, not a code one.
- Audio, voice-over and score.
  `main.ts` runs Phaser with
  `audio: { noAudio: true }` and this story does not change that.
- The in-world lorebook collectible that `docs/PROLOGUE_TREATMENT.md`
  proposes for the unsung stanzas — a content feature of its own.
- Re-watching the prologue from a menu.
  There is no menu.
- Any per-character or per-life replay.
  The flag is account-scoped by
  decision, not by accident.

## Relations

**Realizes**

- [CON-036](../specs/CON-036-the-prologue-flag-is-account-scoped-server-held-and-flips-at-most-once.md)
- [SW-054](../specs/SW-054-the-first-life-is-withheld-until-the-prologue-ends-but-the-death-return-is-not.md)
- [ARCH-014](../specs/ARCH-014-the-verse-lives-in-the-document-and-the-manifest-is-tested-against-it.md)

**Related**

- [CON-033](../specs/CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md) — the sibling account-scoped flip this flag is modelled on
- [SW-053](../specs/SW-053-startlife-computes-the-start-zone-from-tutorial-completion-not-caller-input.md) — the `startLife` call this story gates, and whose own behaviour it leaves alone

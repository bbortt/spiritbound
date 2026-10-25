**Title**
The prologue flag is account-scoped, server-held, and flips at most once

**Lens**: CON

**Status**: active

**Description**
`accountProgress.prologueSeen` is created `false` by `onConnect` with the
rest of the row, and is set `true` only by `markPrologueSeen`, only for
`ctx.sender`, and only while it is still `false`.
A second call is an
ordinary no-op — it returns normally, writes nothing, and is not an
error.
A call from an identity with no `account_progress` row throws a
`SenderError`; the reducer never creates the row, because `onConnect`
owns that.
Nothing ever sets the flag back to `false`: there is no
reset, no per-character scope, and no per-life scope.

**Rationale**
The flag has to outlive the browser.
A client-side marker replays the
whole prologue when the same account connects from a second device and
forgets it entirely on a cache clear — the account identity is the only
thing that survives both, so the only honest place for "this account has
seen it" is the account row.

Idempotence is not defensive padding here, it is the shape of the
caller: the client fires this reducer on both the finish path and the
skip path, and a session that is resumed mid-prologue can reach both.
Making the second call an error would turn an expected sequence into a
surfaced failure for no gain.

Refusing to create the row is the same trust seam every other reducer in
the module keeps — a reducer that conjures an `account_progress` row on
demand would make `onConnect`'s initialisation optional, and the next
field added to that row would be silently absent for anyone who happened
to call this first.

**Verification Description**
An **integration** test against a live published module asserts, for a
freshly minted identity: the account row exists with `prologueSeen`
false; one `mark_prologue_seen` call flips it true; a second call
returns without error and leaves it true; and no other field of
`account_progress` is disturbed by either call.

This is verified end-to-end rather than by unit test for the same reason
`CON-033` is: the reducer reads and writes `account_progress` through
the module context and has no pure function inside it.
A unit test would
have to mock the table and would then be asserting the mock.

## Relations

**Related**

- [STR-015](../stories/STR-015-the-prologue-plays-once-per-account-before-the-first-life.md) — the story delivering this decision
- [CON-033](CON-033-tutorial-completion-stamps-on-death-once-the-characters-zone-appropriate-max-level-was-reached.md) — the sibling flip on the same row; death-gated and server-computed where this one is client-signalled

**Title**
Enemies notice, chase, telegraph, and attack players entirely under server authority

**Lens**: SYS

**Status**: active

**Description**
An enemy's aggro, chase, telegraph, and attack behavior is driven entirely
by server-side scheduled state — the client only reads and interpolates
enemy position/state between ticks.
No client action can grant, suppress,
speed up, or otherwise influence aggro, damage timing, or positioning.

**Rationale**
Per the "preparation over reaction" pillar and the general "client renders,
server decides" trust boundary this codebase applies to combat, enemy
behavior must be exactly as fair and readable for every observer, and
never spoofable or suppressible by a client.

**Verification Description**
Reviewed via the SW/CON specs this realizes, each independently verifiable
by test.

## Relations

**Related**

- [STR-003](../stories/STR-003-enemy-ai.md) — the story delivering this capability

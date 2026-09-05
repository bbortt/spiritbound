<!--
Example story — copy this shape. Each field below is a bold label (Title,
Business Value, ...) on its own line, in the order shown. A "#"/"##" heading is
NOT a field: clew detects a field only as a bold label written like the ones
below. Status carries an inline value after the colon, as shown, and is one of
planned | active | done | dropped (a story is born planned). The "## Relations"
section links the specs the story realizes and the
existing specs it relates to — the ids and paths here are placeholders to
replace. Cite each spec by its id alone; any note goes after the link, not
inside it. This file sits beside the schemas, not in the stories directory, so
clew never treats it as a real story.
-->

**Title**
A concise, decisive statement of the increment

**Status**: planned

**Business Value**
Why the work matters — the benefit to the users or the project.

**Problem / Context**
What is missing or wrong today, and the context the increment sits in.

**Solution Approach**
How the increment is carried out, at a high level — the decisions, not the code.

**Acceptance Criteria**

- A checkable outcome the increment must meet.
- Another — each one a test or a review could confirm.

**Out of scope**

- What this increment deliberately does not do.

## Relations

**Realizes**

- [SW-001](../specs/SW-001-the-behaviour.md) — the behaviour this story delivers

**Related**

- [SW-002](../specs/SW-002-a-related-spec.md) — an existing spec this story touches

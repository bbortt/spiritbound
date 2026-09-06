import type { Reporter, TestModule } from 'vitest/node';

/**
 * Fails any vitest run that collected a *todo* test.
 *
 * A todo test is reported in green and counted as "not failing", so it passes
 * CI by not existing. The way that happens here by accident is
 * `it(name, verifies(ids, () => { ... }))`: `verifies()` runs its block during
 * *collection* and returns `void`, so `it` receives no function body and vitest
 * silently downgrades the test to todo. The anchor still resolves, `clew`
 * still counts the spec as covered, and nothing ever asserts.
 *
 * The correct shape puts `it` *inside* the anchor —
 * `verifies(ids, () => { it(name, () => { ... }); })` — which is what the
 * generated `verifies()` docblock in `src/clew/traceables/clew/index.ts` shows.
 *
 * Registered as a reporter (rather than a separate CI step) so it applies to
 * both suites and to local runs, without a second pass over the test files.
 */

/** The shape this guard needs from a collected test — see vitest's `TestCase`. */
interface CollectedTest {
  readonly fullName: string;
  readonly options: { readonly mode: string };
  readonly location: { readonly line: number } | undefined;
}

/** The shape this guard needs from a test file — see vitest's `TestModule`. */
interface CollectedModule {
  readonly moduleId: string;
  readonly children: { allTests(): Iterable<CollectedTest> };
}

export interface TodoTest {
  /** Test name including its parent suites, as vitest reports it. */
  readonly name: string;
  /** `<file>:<line>`, or just the file when vitest recorded no location. */
  readonly location: string;
}

/**
 * Collects every todo test across the given modules.
 *
 * Deliberately does not report `it.skip` / `describe.skip`: skipping is an
 * explicit, visible choice, whereas todo is what a *missing body* looks like.
 */
export function findTodoTests(
  testModules: Iterable<CollectedModule>,
): TodoTest[] {
  const todoTests: TodoTest[] = [];

  for (const testModule of testModules) {
    for (const testCase of testModule.children.allTests()) {
      if (testCase.options.mode !== 'todo') {
        continue;
      }

      const line = testCase.location?.line;
      todoTests.push({
        name: testCase.fullName,
        location:
          line === undefined
            ? testModule.moduleId
            : `${testModule.moduleId}:${line}`,
      });
    }
  }

  return todoTests;
}

/** The message printed when the guard trips, kept here so a test can assert it. */
export function formatTodoTestFailure(todoTests: readonly TodoTest[]): string {
  const heading =
    todoTests.length === 1
      ? '1 todo test was collected but never ran:'
      : `${todoTests.length} todo tests were collected but never ran:`;

  const listed = todoTests
    .map((todoTest) => `  - ${todoTest.name}\n    at ${todoTest.location}`)
    .join('\n');

  return [
    `\nTodo-test guard failed. ${heading}`,
    listed,
    '',
    'A todo test passes CI by not existing. The usual cause is passing the',
    'clew anchor as the test body:',
    '',
    '  it(name, verifies(ids, () => { ... }))        // wrong — `it` gets no body',
    '  verifies(ids, () => { it(name, () => { ... }) }) // right',
    '',
    'If a test is genuinely unwritten, delete it or track it in docs/spec/',
    'rather than leaving a green placeholder in the suite.',
    '',
  ].join('\n');
}

export default class NoTodoTestsReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: unknown,
    reason: string,
  ): void {
    // An interrupted run collected an arbitrary subset; enforcing against it
    // would report todos that a complete run may not even reach.
    if (reason === 'interrupted') {
      return;
    }

    const todoTests = findTodoTests(testModules);
    if (todoTests.length === 0) {
      return;
    }

    console.error(formatTodoTestFailure(todoTests));
    process.exitCode = 1;
  }
}

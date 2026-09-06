import { describe, expect, it } from 'vitest';

import { findTodoTests, formatTodoTestFailure } from './vitest.noTodoTests.js';

/**
 * A guard that fails silently is worse than no guard, so the detection itself
 * is tested against hand-built stand-ins for vitest's `TestModule`/`TestCase`.
 */
function testModule(
  moduleId: string,
  tests: readonly {
    fullName: string;
    mode: string;
    line?: number;
  }[],
) {
  return {
    moduleId,
    children: {
      allTests: () =>
        tests.map((test) => ({
          fullName: test.fullName,
          options: { mode: test.mode },
          location: test.line === undefined ? undefined : { line: test.line },
        })),
    },
  };
}

describe('findTodoTests', () => {
  it('reports a todo test with its file and line', () => {
    const todoTests = findTodoTests([
      testModule('/repo/rules/death.test.ts', [
        { fullName: 'death > drops the card', mode: 'todo', line: 42 },
      ]),
    ]);

    expect(todoTests).toEqual([
      {
        name: 'death > drops the card',
        location: '/repo/rules/death.test.ts:42',
      },
    ]);
  });

  it('falls back to the file alone when vitest recorded no location', () => {
    const todoTests = findTodoTests([
      testModule('/repo/rules/death.test.ts', [
        { fullName: 'death > drops the card', mode: 'todo' },
      ]),
    ]);

    expect(todoTests[0]?.location).toBe('/repo/rules/death.test.ts');
  });

  it('ignores tests that actually ran', () => {
    expect(
      findTodoTests([
        testModule('/repo/a.test.ts', [{ fullName: 'passes', mode: 'run' }]),
      ]),
    ).toEqual([]);
  });

  it('ignores explicitly skipped tests, which are a deliberate visible choice', () => {
    expect(
      findTodoTests([
        testModule('/repo/a.test.ts', [{ fullName: 'skipped', mode: 'skip' }]),
      ]),
    ).toEqual([]);
  });

  it('collects todos across every module', () => {
    const todoTests = findTodoTests([
      testModule('/repo/a.test.ts', [
        { fullName: 'a todo', mode: 'todo', line: 1 },
        { fullName: 'a run', mode: 'run', line: 2 },
      ]),
      testModule('/repo/b.test.ts', [
        { fullName: 'b todo', mode: 'todo', line: 3 },
      ]),
    ]);

    expect(todoTests.map((todoTest) => todoTest.name)).toEqual([
      'a todo',
      'b todo',
    ]);
  });
});

describe('formatTodoTestFailure', () => {
  it('names every offender and points at the verifies() misuse', () => {
    const message = formatTodoTestFailure([
      { name: 'death > drops the card', location: '/repo/death.test.ts:42' },
    ]);

    expect(message).toContain('1 todo test was collected but never ran');
    expect(message).toContain('death > drops the card');
    expect(message).toContain('/repo/death.test.ts:42');
    expect(message).toContain('verifies(');
  });

  it('pluralises the count', () => {
    const message = formatTodoTestFailure([
      { name: 'one', location: 'a.test.ts:1' },
      { name: 'two', location: 'b.test.ts:2' },
    ]);

    expect(message).toContain('2 todo tests were collected but never ran');
  });
});

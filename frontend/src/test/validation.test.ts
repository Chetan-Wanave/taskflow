// domain/validation.ts is the ONE rule set shared by the QuickAdd composer and BOTH
// storage adapters (LocalStorageAdapter, and the MSW mockApi behind ApiAdapter), so a
// drift here would let a task save locally and 400 on the flip to API mode. Until now it
// was covered only indirectly through adapterContract.test.ts; every rule is pinned here
// at its boundary. Callers reject the WHOLE import when `errors` is non-empty, so the
// import tests assert on `errors` first and on the normalized rows second. Timestamps
// filled by validateImportData come from the wall clock, so only their shape is asserted.

import { describe, expect, it } from 'vitest'
import type { AppData, Priority, Task } from '../domain/types'
import type { FieldError } from '../domain/validation'
import {
  tagNameKey,
  validateDueDate,
  validateImportData,
  validateNotes,
  validatePosition,
  validateTag,
  validateTask,
  validateTaskPatch,
  validateTitle,
} from '../domain/validation'

const NOW = '2026-09-07T10:00:00.000Z'
const KNOWN_TAGS: ReadonlySet<string> = new Set(['tag-work', 'tag-home'])

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Buy milk',
    notes: null,
    priority: 'NONE',
    dueDate: null,
    completedAt: null,
    position: 1024,
    parentId: null,
    tagIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

/** Import rows are untrusted JSON, so tests build them loosely and cast once. */
function envelope(tasks: unknown[], tags: unknown[] = []): AppData {
  return { schemaVersion: 2, tasks, tags } as unknown as AppData
}

const fields = (errors: FieldError[]): string[] => errors.map((e) => e.field)

describe('tagNameKey', () => {
  it('folds case so Work / wORK / WORK share one key', () => {
    expect(tagNameKey('Work')).toBe('work')
    expect(tagNameKey('wORK')).toBe('work')
    expect(tagNameKey('WORK')).toBe(tagNameKey('work'))
  })

  it('folds accents the way utf8mb4_0900_ai_ci does: café and cafe collide', () => {
    expect(tagNameKey('café')).toBe('cafe')
    expect(tagNameKey('CAFÉ')).toBe('cafe')
    expect(tagNameKey('Ünïcödé')).toBe('unicode')
  })

  it('treats precomposed and decomposed forms of the same letter as equal', () => {
    // U+00E9 (e-acute as one code point) vs plain e followed by U+0301 (combining acute)
    expect(tagNameKey('caf\u00e9')).toBe(tagNameKey('cafe\u0301'))
    expect(tagNameKey('cafe\u0301')).toBe('cafe')
  })

  it('trims surrounding whitespace but keeps inner spaces', () => {
    expect(tagNameKey('  Deep Work  ')).toBe('deep work')
  })

  it('does not collapse genuinely different names', () => {
    expect(tagNameKey('work')).not.toBe(tagNameKey('works'))
    expect(tagNameKey('résumé')).not.toBe(tagNameKey('resume2'))
  })
})

describe('validateTitle', () => {
  it('accepts a normal title', () => {
    expect(validateTitle('Buy milk')).toEqual([])
  })

  it('rejects blank and non-string titles with one "must not be blank" error', () => {
    const blank: FieldError = { field: 'title', message: 'must not be blank' }
    expect(validateTitle('')).toEqual([blank])
    expect(validateTitle('   \t ')).toEqual([blank])
    expect(validateTitle(undefined)).toEqual([blank])
    expect(validateTitle(null)).toEqual([blank])
    expect(validateTitle(42)).toEqual([blank])
  })

  it('allows exactly 500 characters after trimming and rejects 501', () => {
    expect(validateTitle('a'.repeat(500))).toEqual([])
    expect(validateTitle(`  ${'a'.repeat(500)}  `)).toEqual([]) // padding is not counted
    expect(validateTitle('a'.repeat(501))).toEqual([
      { field: 'title', message: 'must be at most 500 characters' },
    ])
  })
})

describe('validateNotes', () => {
  it('accepts null (cleared) and any string up to 10000 characters', () => {
    expect(validateNotes(null)).toEqual([])
    expect(validateNotes('')).toEqual([])
    expect(validateNotes('x'.repeat(10_000))).toEqual([])
  })

  it('rejects 10001 characters', () => {
    expect(validateNotes('x'.repeat(10_001))).toEqual([
      { field: 'notes', message: 'must be at most 10000 characters' },
    ])
  })

  it('rejects non-string values — undefined is NOT the same as null here', () => {
    const err: FieldError = { field: 'notes', message: 'must be a string or null' }
    expect(validateNotes(undefined)).toEqual([err])
    expect(validateNotes(123)).toEqual([err])
    expect(validateNotes(['a'])).toEqual([err])
  })
})

describe('validateDueDate', () => {
  it('accepts null and a real YYYY-MM-DD date', () => {
    expect(validateDueDate(null)).toEqual([])
    expect(validateDueDate('2026-09-07')).toEqual([])
    expect(validateDueDate('2024-02-29')).toEqual([]) // leap day
  })

  it('rejects impossible dates, other formats, and Date objects', () => {
    const err: FieldError = {
      field: 'dueDate',
      message: 'must be a real calendar date in YYYY-MM-DD format',
    }
    expect(validateDueDate('2026-13-45')).toEqual([err]) // the value adapterContract sends
    expect(validateDueDate('2023-02-29')).toEqual([err]) // not a leap year
    expect(validateDueDate('2026-09-07T00:00:00.000Z')).toEqual([err]) // timestamp, not a date
    expect(validateDueDate('07/09/2026')).toEqual([err])
    expect(validateDueDate(new Date(0))).toEqual([err]) // dueDate is NEVER a Date object
    expect(validateDueDate(undefined)).toEqual([err])
  })
})

describe('validatePosition', () => {
  it('accepts positive integers, including the 1024 gap and large renormalized values', () => {
    expect(validatePosition(1)).toEqual([])
    expect(validatePosition(1024)).toEqual([])
    expect(validatePosition(99 * 1024)).toEqual([])
  })

  it('rejects zero, negatives, fractions, NaN, and numeric strings', () => {
    const err: FieldError = { field: 'position', message: 'must be an integer greater than 0' }
    expect(validatePosition(0)).toEqual([err]) // the value adapterContract sends
    expect(validatePosition(-1024)).toEqual([err])
    expect(validatePosition(1.5)).toEqual([err])
    expect(validatePosition(Number.NaN)).toEqual([err])
    expect(validatePosition('1024')).toEqual([err])
    expect(validatePosition(undefined)).toEqual([err])
  })
})

describe('validateTag', () => {
  it('accepts a name with a #RRGGBB color in either case, or a null color', () => {
    expect(validateTag({ name: 'Work', color: '#5B5BD6' })).toEqual([])
    expect(validateTag({ name: 'Work', color: '#5b5bd6' })).toEqual([])
    expect(validateTag({ name: 'Work', color: null })).toEqual([])
  })

  it('rejects a blank name and allows exactly 50 characters after trimming', () => {
    expect(validateTag({ name: '   ', color: null })).toEqual([
      { field: 'name', message: 'must not be blank' },
    ])
    expect(validateTag({ name: 'n'.repeat(50), color: null })).toEqual([])
    expect(validateTag({ name: ` ${'n'.repeat(50)} `, color: null })).toEqual([])
    expect(validateTag({ name: 'n'.repeat(51), color: null })).toEqual([
      { field: 'name', message: 'must be at most 50 characters' },
    ])
  })

  it('rejects colors that are not exactly #RRGGBB', () => {
    const err: FieldError = { field: 'color', message: 'must match #RRGGBB' }
    expect(validateTag({ name: 'Work', color: 'blue' })).toEqual([err])
    expect(validateTag({ name: 'Work', color: '#FFF' })).toEqual([err]) // shorthand
    expect(validateTag({ name: 'Work', color: '#GG0000' })).toEqual([err]) // not hex
    expect(validateTag({ name: 'Work', color: '5B5BD6' })).toEqual([err]) // missing #
    expect(validateTag({ name: 'Work', color: ' #5B5BD6' })).toEqual([err]) // no trimming
  })

  it('reports name and color errors together, name first', () => {
    expect(fields(validateTag({ name: '', color: 'blue' }))).toEqual(['name', 'color'])
  })
})

describe('validateTask', () => {
  it('accepts a well-formed task whose tagIds all exist', () => {
    const task = makeTask({ tagIds: ['tag-work', 'tag-home'], dueDate: '2026-09-08', notes: 'n' })
    expect(validateTask(task, KNOWN_TAGS)).toEqual([])
  })

  it('reports one tagIds error per unknown tag id, naming the id', () => {
    const task = makeTask({ tagIds: ['tag-work', 'ghost-1', 'ghost-2'] })
    expect(validateTask(task, KNOWN_TAGS)).toEqual([
      { field: 'tagIds', message: 'unknown tag id ghost-1' },
      { field: 'tagIds', message: 'unknown tag id ghost-2' },
    ])
  })

  it('rejects a priority outside NONE/LOW/MEDIUM/HIGH', () => {
    const task = makeTask({ priority: 'URGENT' as unknown as Priority })
    expect(validateTask(task, KNOWN_TAGS)).toEqual([
      { field: 'priority', message: 'must be one of NONE, LOW, MEDIUM, HIGH' },
    ])
  })

  it('aggregates every field failure in title, dueDate, position order', () => {
    const task = makeTask({ title: ' ', dueDate: '2026-02-30', position: 0 })
    expect(fields(validateTask(task, KNOWN_TAGS))).toEqual(['title', 'dueDate', 'position'])
  })
})

describe('validateTaskPatch', () => {
  it('an empty patch is valid — absent means unchanged', () => {
    expect(validateTaskPatch({}, KNOWN_TAGS)).toEqual([])
  })

  it('explicit null is valid for the clearable fields notes and dueDate', () => {
    expect(validateTaskPatch({ notes: null, dueDate: null }, KNOWN_TAGS)).toEqual([])
  })

  it('validates only the fields that are present', () => {
    expect(validateTaskPatch({ title: '' }, KNOWN_TAGS)).toEqual([
      { field: 'title', message: 'must not be blank' },
    ])
    expect(validateTaskPatch({ dueDate: '2026-13-45' }, KNOWN_TAGS)).toEqual([
      { field: 'dueDate', message: 'must be a real calendar date in YYYY-MM-DD format' },
    ])
    expect(validateTaskPatch({ position: 0 }, KNOWN_TAGS)).toEqual([
      { field: 'position', message: 'must be an integer greater than 0' },
    ])
    expect(validateTaskPatch({ priority: 'urgent' }, KNOWN_TAGS)).toEqual([
      { field: 'priority', message: 'must be one of NONE, LOW, MEDIUM, HIGH' },
    ])
    expect(validateTaskPatch({ tagIds: ['tag-work', 'ghost'] }, KNOWN_TAGS)).toEqual([
      { field: 'tagIds', message: 'unknown tag id ghost' },
    ])
  })

  it('accepts a full valid patch, including the completed flag', () => {
    const patch = {
      title: 'Buy oat milk',
      notes: 'the barista kind',
      priority: 'HIGH',
      dueDate: '2026-09-08',
      position: 2048,
      tagIds: ['tag-home'],
      completed: true,
    }
    expect(validateTaskPatch(patch, KNOWN_TAGS)).toEqual([])
  })

  it('collects errors from several bad fields in one call', () => {
    const patch = { title: '', dueDate: '2026-13-45', priority: 1 }
    expect(fields(validateTaskPatch(patch, KNOWN_TAGS))).toEqual(['title', 'dueDate', 'priority'])
  })
})

describe('validateImportData', () => {
  it('returns empty arrays for an empty envelope', () => {
    expect(validateImportData(envelope([], []), KNOWN_TAGS)).toEqual({
      tasks: [],
      tags: [],
      errors: [],
    })
  })

  it('normalizes a valid envelope: trims names and titles, fills defaults, keeps given timestamps', () => {
    const data = envelope(
      [
        {
          id: 'task-1',
          title: '  Buy milk  ',
          position: 1024,
          tagIds: ['tag-import'], // defined by the SAME import, not in existingTagIds
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      [{ id: 'tag-import', name: '  Errands ', color: '#5B5BD6', createdAt: NOW }],
    )
    const result = validateImportData(data, KNOWN_TAGS)
    expect(result.errors).toEqual([])
    expect(result.tags).toEqual([
      { id: 'tag-import', name: 'Errands', color: '#5B5BD6', createdAt: NOW },
    ])
    expect(result.tasks).toEqual([
      {
        id: 'task-1',
        title: 'Buy milk',
        notes: null,
        priority: 'NONE',
        dueDate: null,
        completedAt: null,
        position: 1024,
        parentId: null,
        tagIds: ['tag-import'],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
  })

  it('fills missing timestamps and a missing tag color (shape only — the value is the wall clock)', () => {
    const data = envelope(
      [{ id: 'task-1', title: 'Untimed', position: 1024 }],
      [{ id: 'tag-1', name: 'Bare' }],
    )
    const { tasks, tags, errors } = validateImportData(data, KNOWN_TAGS)
    expect(errors).toEqual([])
    expect(tags[0].color).toBeNull()
    // One `nowISO` is captured at the top of validateImportData and fills every gap, so
    // the three timestamps must share the ISO-8601 millisecond shape AND be identical.
    const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    expect(tags[0].createdAt).toMatch(ISO_MS)
    expect(tasks[0].createdAt).toMatch(ISO_MS)
    expect(tasks[0].updatedAt).toBe(tasks[0].createdAt)
    expect(tags[0].createdAt).toBe(tasks[0].createdAt)
  })

  it('accepts tasks that reference tags already in the store (existingTagIds)', () => {
    const data = envelope([
      { id: 'task-1', title: 'Home chores', position: 1024, tagIds: ['tag-home'] },
    ])
    expect(validateImportData(data, KNOWN_TAGS).errors).toEqual([])
  })

  it('rejects malformed rows with an index-addressed field path', () => {
    const data = envelope(
      [
        'not-an-object',
        { id: 'task-b', title: 'Bad tagIds', position: 1024, tagIds: 'nope' },
        { id: 'task-c', title: 'Bad completedAt', position: 1024, completedAt: 123 },
        { id: 'task-d', title: 'Bad parentId', position: 1024, parentId: 5 },
        { title: 'No id at all', position: 1024 },
      ],
      [{ id: 'tag-x' }, 42],
    )
    expect(validateImportData(data, KNOWN_TAGS).errors).toEqual([
      { field: 'tags[0]', message: 'must be a tag object with string id and name' },
      { field: 'tags[1]', message: 'must be a tag object with string id and name' },
      { field: 'tasks[0]', message: 'must be a task object with a string id' },
      { field: 'tasks[1].tagIds', message: 'must be an array of tag id strings' },
      { field: 'tasks[2].completedAt', message: 'must be a timestamp string or null' },
      { field: 'tasks[3].parentId', message: 'must be a task id string or null' },
      { field: 'tasks[4]', message: 'must be a task object with a string id' },
    ])
  })

  it('prefixes per-field rule violations with tasks[i] / tags[i]', () => {
    const data = envelope(
      [{ id: 'task-1', title: '   ', position: 0, priority: 'URGENT', dueDate: '2026-13-45' }],
      [{ id: 'tag-1', name: '', color: 'blue' }],
    )
    expect(fields(validateImportData(data, KNOWN_TAGS).errors)).toEqual([
      'tags[0].name',
      'tags[0].color',
      'tasks[0].title',
      'tasks[0].dueDate',
      'tasks[0].position',
      'tasks[0].priority',
    ])
  })

  it('flags a task that references a tag neither in the import nor in the store', () => {
    const data = envelope([{ id: 'task-1', title: 'Orphan', position: 1024, tagIds: ['ghost'] }])
    expect(validateImportData(data, KNOWN_TAGS).errors).toEqual([
      { field: 'tasks[0].tagIds', message: 'unknown tag id ghost' },
    ])
  })

  it('does not add unknown-tag noise for a task that references an INVALID but well-shaped tag', () => {
    // The tag row fails its own rule (bad color), but its id is still registered so the
    // user sees one root cause, not a cascade of unknown-tag errors.
    const data = envelope(
      [{ id: 'task-1', title: 'Uses bad tag', position: 1024, tagIds: ['tag-bad'] }],
      [{ id: 'tag-bad', name: 'Bad', color: 'blue' }],
    )
    expect(validateImportData(data, KNOWN_TAGS).errors).toEqual([
      { field: 'tags[0].color', message: 'must match #RRGGBB' },
    ])
  })

  it('excludes invalid rows from the normalized output while keeping the valid ones', () => {
    const data = envelope([
      { id: 'task-ok', title: 'Fine', position: 1024 },
      { id: 'task-bad', title: '', position: 2048 },
    ])
    const { tasks, errors } = validateImportData(data, KNOWN_TAGS)
    expect(errors).toHaveLength(1)
    expect(tasks.map((t) => t.id)).toEqual(['task-ok'])
  })
})

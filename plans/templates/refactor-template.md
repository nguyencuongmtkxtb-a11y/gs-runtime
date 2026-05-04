# Refactor: [Component Name]

## Motivation

Why is this refactor needed? (performance, readability, maintainability, etc.)

## Current State

Describe the current code structure and its problems.

## Target State

Describe the desired code structure after refactoring.

## Blast Radius

| File | Change | Risk |
|------|--------|------|
| `path/to/file.ts` | Extract function | Low |
| `path/to/file.ts` | Rename class | Medium |

## Plan

| # | Task | Verification |
|---|------|-------------|
| 1 | Extract `helperFunction` from `bigFunction` | Tests still pass |
| 2 | Rename `OldName` → `NewName` | All references updated |
| 3 | Split `large-file.ts` into modules | Tests still pass |

## Safety Checks

- [ ] All existing tests pass
- [ ] No API changes (backward compatible)
- [ ] Git history preserved (use `git mv` for renames)
- [ ] Documentation updated

## Rollback Plan

How to revert if something goes wrong:
```bash
git revert <commit-hash>
```

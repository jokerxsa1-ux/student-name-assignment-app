import { describe, expect, it } from 'vitest';
import { findDuplicateNames, normalizeNames } from './roster';
import type { Student } from './types';

describe('名簿処理', () => {
  it('空行と前後の空白を除去する', () => {
    expect(normalizeNames(' 児童01 \n\n児童02\r\n  ')).toEqual(['児童01', '児童02']);
  });

  it('同じ表示名を検出する', () => {
    const students: Student[] = [
      { id: 'a', name: '児童01', excluded: false },
      { id: 'b', name: '児童01', excluded: false },
      { id: 'c', name: '児童02', excluded: false },
    ];
    expect([...findDuplicateNames(students)]).toEqual(['児童01']);
  });
});

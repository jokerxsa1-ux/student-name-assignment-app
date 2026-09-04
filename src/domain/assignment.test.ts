import { describe, expect, it } from 'vitest';
import {
  assignGroups,
  assignOrder,
  assignSeats,
  createSeats,
  evaluateSeatAssignment,
  sameSeatPlacement,
} from './assignment';
import type { GroupConstraints, SeatConstraints, SeatHistoryEntry, Student } from './types';

const students = (count: number): Student[] => Array.from({ length: count }, (_, index) => ({
  id: `s${index + 1}`,
  name: `児童${index + 1}`,
  excluded: false,
}));

const emptySeatConstraints = (): SeatConstraints => ({ fixedByStudent: {}, frontRowLimitByStudent: {}, separationPairs: [] });
const emptyGroupConstraints = (): GroupConstraints => ({ fixedByStudent: {}, separationPairs: [] });

function lcg(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value;
  };
}

describe('席替え', () => {
  it('対象者を重複・欠落なく1回ずつ配置する', () => {
    const roster = students(6);
    roster[5].excluded = true;
    const result = assignSeats(roster, createSeats(2, 3), emptySeatConstraints(), [], 50, lcg());
    const assigned = Object.values(result.assignmentBySeat).filter(Boolean);
    expect(assigned).toHaveLength(5);
    expect(new Set(assigned).size).toBe(5);
    expect(assigned).not.toContain('s6');
  });

  it('固定席と無効席を守る', () => {
    const seats = createSeats(2, 2).map((seat) => seat.id === 'r1c1' ? { ...seat, enabled: false } : seat);
    const constraints = emptySeatConstraints();
    constraints.fixedByStudent.s1 = 'r0c0';
    const result = assignSeats(students(3), seats, constraints, [], 50, lcg());
    expect(result.assignmentBySeat.r0c0).toBe('s1');
    expect(result.assignmentBySeat.r1c1).toBeNull();
  });

  it('前方指定を満たせる場合は満たす', () => {
    const constraints = emptySeatConstraints();
    constraints.frontRowLimitByStudent.s1 = 1;
    const seats = createSeats(2, 2);
    const result = assignSeats(students(4), seats, constraints, [], 100, lcg());
    const seatId = Object.entries(result.assignmentBySeat).find(([, id]) => id === 's1')?.[0];
    expect(seats.find((seat) => seat.id === seatId)?.row).toBe(0);
  });

  it('離す条件を満たせる場合は隣接させない', () => {
    const constraints = emptySeatConstraints();
    constraints.separationPairs.push({ id: 'pair', studentAId: 's1', studentBId: 's2' });
    const seats = createSeats(3, 3);
    const result = assignSeats(students(4), seats, constraints, [], 500, lcg(8));
    expect(result.evaluation.violations.find((item) => item.id === 'pair')).toBeUndefined();
  });

  it('不可能な分離条件では上限で終了して警告を返す', () => {
    const constraints = emptySeatConstraints();
    constraints.separationPairs.push({ id: 'pair', studentAId: 's1', studentBId: 's2' });
    const result = assignSeats(students(2), createSeats(1, 2), constraints, [], 7, lcg());
    expect(result.attempts).toBe(7);
    expect(result.evaluation.violations.some((item) => item.id === 'pair')).toBe(true);
  });

  it('通常条件が同点なら直近履歴と違う席を優先する', () => {
    const history: SeatHistoryEntry = {
      id: 'h1',
      createdAt: new Date(0).toISOString(),
      placementByStudent: {
        s1: { row: 0, column: 0 },
        s2: { row: 0, column: 1 },
        s3: { row: 1, column: 0 },
        s4: { row: 1, column: 1 },
      },
    };
    const result = assignSeats(students(4), createSeats(2, 2), emptySeatConstraints(), [history], 500, lcg(12));
    expect(result.evaluation.coreScore).toBe(0);
    expect(result.evaluation.historyScore).toBeLessThan(8);
  });

  it('手動で固定席を崩すと違反として再評価する', () => {
    const constraints = emptySeatConstraints();
    constraints.fixedByStudent.s1 = 'r0c0';
    const evaluation = evaluateSeatAssignment(
      { r0c0: 's2', r0c1: 's1' },
      students(2),
      createSeats(1, 2),
      constraints,
    );
    expect(evaluation.violations.some((item) => item.kind === 'fixed')).toBe(true);
  });

  it('生徒ごとの座標が同じ履歴を同一配置と判定する', () => {
    expect(sameSeatPlacement(
      { s1: { row: 0, column: 0 }, s2: { row: 1, column: 1 } },
      { s2: { row: 1, column: 1 }, s1: { row: 0, column: 0 } },
    )).toBe(true);
    expect(sameSeatPlacement(
      { s1: { row: 0, column: 0 } },
      { s1: { row: 0, column: 1 } },
    )).toBe(false);
  });
});

describe('グループ分け', () => {
  it('人数差を1人以内にして全員を配置する', () => {
    const result = assignGroups(students(10), ['g1', 'g2', 'g3'], emptyGroupConstraints(), 100, lcg());
    const sizes = Object.values(result.studentIdsByGroup).map((ids) => ids.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(new Set(Object.values(result.studentIdsByGroup).flat()).size).toBe(10);
  });

  it('固定グループを維持し、可能なら指定ペアを離す', () => {
    const constraints = emptyGroupConstraints();
    constraints.fixedByStudent.s1 = 'g1';
    constraints.separationPairs.push({ id: 'pair', studentAId: 's1', studentBId: 's2' });
    const result = assignGroups(students(6), ['g1', 'g2', 'g3'], constraints, 200, lcg(4));
    expect(result.studentIdsByGroup.g1).toContain('s1');
    expect(result.studentIdsByGroup.g1).not.toContain('s2');
  });
});

describe('順番決め', () => {
  it('除外者を除き、先頭と最後を固定する', () => {
    const roster = students(5);
    roster[2].excluded = true;
    const result = assignOrder(roster, { firstStudentId: 's1', lastStudentId: 's5' }, lcg());
    expect(result.orderedStudentIds[0]).toBe('s1');
    expect(result.orderedStudentIds.at(-1)).toBe('s5');
    expect(result.orderedStudentIds).not.toContain('s3');
    expect(new Set(result.orderedStudentIds).size).toBe(4);
  });
});

import { appConfig } from '../appConfig';
import { createInternalId } from './roster';
import { shuffled, type RandomUint32Source } from './random';
import type {
  AssignmentEvaluation,
  ConstraintViolation,
  GroupAssignmentResult,
  GroupConstraints,
  GroupId,
  OrderAssignmentResult,
  OrderConstraints,
  Seat,
  SeatAssignmentResult,
  SeatConstraints,
  SeatHistoryEntry,
  Student,
  StudentId,
} from './types';

export function createSeats(rows: number, columns: number): Seat[] {
  return Array.from({ length: rows * columns }, (_, index) => ({
    id: `r${Math.floor(index / columns)}c${index % columns}`,
    row: Math.floor(index / columns),
    column: index % columns,
    enabled: true,
  }));
}

export function validateSeatAssignment(
  students: readonly Student[],
  seats: readonly Seat[],
  constraints: SeatConstraints,
): string[] {
  const activeIds = new Set(students.filter((student) => !student.excluded).map((student) => student.id));
  const enabledIds = new Set(seats.filter((seat) => seat.enabled).map((seat) => seat.id));
  const errors: string[] = [];
  if (!activeIds.size) errors.push('対象の生徒が0人です。除外設定または名簿を確認してください。');
  if (activeIds.size > enabledIds.size) errors.push('対象生徒数が有効席数を超えています。席を増やすか除外設定を確認してください。');

  const occupied = new Map<string, string>();
  Object.entries(constraints.fixedByStudent).forEach(([studentId, seatId]) => {
    if (!activeIds.has(studentId)) return;
    if (!enabledIds.has(seatId)) errors.push('無効または存在しない席へ固定されています。固定席を選び直してください。');
    if (occupied.has(seatId)) errors.push('同じ席へ複数の生徒が固定されています。固定席を変更してください。');
    occupied.set(seatId, studentId);
  });
  return [...new Set(errors)];
}

export function evaluateSeatAssignment(
  assignmentBySeat: Record<string, StudentId | null>,
  students: readonly Student[],
  seats: readonly Seat[],
  constraints: SeatConstraints,
  histories: readonly SeatHistoryEntry[] = [],
): AssignmentEvaluation {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const seatById = new Map(seats.map((seat) => [seat.id, seat]));
  const seatIdByStudent = new Map<StudentId, string>();
  Object.entries(assignmentBySeat).forEach(([seatId, studentId]) => {
    if (studentId) seatIdByStudent.set(studentId, seatId);
  });

  const violations: ConstraintViolation[] = [];
  const satisfiedConstraintIds: string[] = [];

  Object.entries(constraints.fixedByStudent).forEach(([studentId, fixedSeatId]) => {
    if (studentById.get(studentId)?.excluded) return;
    const id = `fixed:${studentId}`;
    if (seatIdByStudent.get(studentId) !== fixedSeatId) {
      violations.push({ id, kind: 'fixed', studentIds: [studentId], message: `${studentById.get(studentId)?.name ?? '生徒'}が固定席から移動しています。`, score: 1 });
    } else satisfiedConstraintIds.push(id);
  });

  Object.entries(constraints.frontRowLimitByStudent).forEach(([studentId, rowLimit]) => {
    if (studentById.get(studentId)?.excluded) return;
    const id = `front:${studentId}`;
    const seat = seatById.get(seatIdByStudent.get(studentId) ?? '');
    if (seat && seat.row >= rowLimit) {
      violations.push({ id, kind: 'front-row', studentIds: [studentId], message: `${studentById.get(studentId)?.name ?? '生徒'}を前から${rowLimit}行以内に配置できませんでした。`, score: 1 });
    } else satisfiedConstraintIds.push(id);
  });

  constraints.separationPairs.forEach((pair) => {
    if (studentById.get(pair.studentAId)?.excluded || studentById.get(pair.studentBId)?.excluded) return;
    const a = seatById.get(seatIdByStudent.get(pair.studentAId) ?? '');
    const b = seatById.get(seatIdByStudent.get(pair.studentBId) ?? '');
    if (a && b && areAdjacent(a, b)) {
      violations.push({
        id: pair.id,
        kind: 'separation',
        studentIds: [pair.studentAId, pair.studentBId],
        message: `${studentById.get(pair.studentAId)?.name ?? '生徒'}と${studentById.get(pair.studentBId)?.name ?? '生徒'}が隣接しています。`,
        score: 1,
      });
    } else satisfiedConstraintIds.push(pair.id);
  });

  let historyScore = 0;
  histories.slice(0, appConfig.historyLimit).forEach((history) => {
    seatIdByStudent.forEach((seatId, studentId) => {
      const current = seatById.get(seatId);
      const previous = history.placementByStudent[studentId];
      if (!current || !previous) return;
      const rowDistance = Math.abs(current.row - previous.row);
      const columnDistance = Math.abs(current.column - previous.column);
      if (rowDistance === 0 && columnDistance === 0) historyScore += 2;
      else if (rowDistance <= 1 && columnDistance <= 1) historyScore += 1;
    });
  });

  if (historyScore > 0) {
    violations.push({
      id: 'history-similarity',
      kind: 'history-similarity',
      studentIds: [],
      message: `直近2回と近い席が残っています（類似度 ${historyScore}）。通常条件を優先した最良案です。`,
      score: historyScore,
    });
  }

  return {
    coreScore: violations.filter((item) => item.kind !== 'history-similarity' && item.kind !== 'fixed').reduce((sum, item) => sum + item.score, 0),
    historyScore,
    violations,
    satisfiedConstraintIds,
  };
}

export function assignSeats(
  students: readonly Student[],
  seats: readonly Seat[],
  constraints: SeatConstraints,
  histories: readonly SeatHistoryEntry[] = [],
  attempts: number = appConfig.assignmentAttempts,
  source?: RandomUint32Source,
): SeatAssignmentResult {
  const errors = validateSeatAssignment(students, seats, constraints);
  if (errors.length) throw new Error(errors.join('\n'));

  const activeStudents = students.filter((student) => !student.excluded);
  const enabledSeats = seats.filter((seat) => seat.enabled);
  const fixedStudentIds = new Set(Object.keys(constraints.fixedByStudent).filter((id) => activeStudents.some((student) => student.id === id)));
  let best: SeatAssignmentResult | undefined;
  let executedAttempts = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    executedAttempts = attempt;
    const assignment = Object.fromEntries(seats.map((seat) => [seat.id, null])) as Record<string, StudentId | null>;
    fixedStudentIds.forEach((studentId) => {
      assignment[constraints.fixedByStudent[studentId]] = studentId;
    });
    let available = shuffled(enabledSeats.filter((seat) => assignment[seat.id] === null), source);
    const remaining = activeStudents.filter((student) => !fixedStudentIds.has(student.id));
    const frontStudents = shuffled(
      remaining.filter((student) => constraints.frontRowLimitByStudent[student.id] != null),
      source,
    ).sort((a, b) => constraints.frontRowLimitByStudent[a.id] - constraints.frontRowLimitByStudent[b.id]);
    const placed = new Set<StudentId>();

    frontStudents.forEach((student) => {
      const limit = constraints.frontRowLimitByStudent[student.id];
      const eligible = available.filter((seat) => seat.row < limit);
      if (!eligible.length) return;
      const selected = shuffled(eligible, source)[0];
      assignment[selected.id] = student.id;
      available = available.filter((seat) => seat.id !== selected.id);
      placed.add(student.id);
    });

    shuffled(remaining.filter((student) => !placed.has(student.id)), source).forEach((student, index) => {
      assignment[available[index].id] = student.id;
    });

    const evaluation = evaluateSeatAssignment(assignment, students, seats, constraints, histories);
    const candidate = { assignmentBySeat: assignment, evaluation, attempts: attempt };
    if (!best || isBetterEvaluation(evaluation, best.evaluation)) best = candidate;
    if (evaluation.coreScore === 0 && evaluation.historyScore === 0) break;
  }
  if (!best) throw new Error('席替え結果を作成できませんでした。');
  return { ...best, attempts: executedAttempts };
}

export function createSeatHistory(result: SeatAssignmentResult, seats: readonly Seat[]): SeatHistoryEntry {
  const seatById = new Map(seats.map((seat) => [seat.id, seat]));
  const placementByStudent: SeatHistoryEntry['placementByStudent'] = {};
  Object.entries(result.assignmentBySeat).forEach(([seatId, studentId]) => {
    const seat = seatById.get(seatId);
    if (seat && studentId) placementByStudent[studentId] = { row: seat.row, column: seat.column };
  });
  return { id: createInternalId(), createdAt: new Date().toISOString(), placementByStudent };
}

export function sameSeatPlacement(
  first: SeatHistoryEntry['placementByStudent'],
  second: SeatHistoryEntry['placementByStudent'],
): boolean {
  const firstIds = Object.keys(first);
  const secondIds = Object.keys(second);
  return firstIds.length === secondIds.length && firstIds.every((studentId) => {
    const a = first[studentId];
    const b = second[studentId];
    return Boolean(a && b && a.row === b.row && a.column === b.column);
  });
}

export function assignGroups(
  students: readonly Student[],
  groupIds: readonly GroupId[],
  constraints: GroupConstraints,
  attempts: number = appConfig.assignmentAttempts,
  source?: RandomUint32Source,
): GroupAssignmentResult {
  const active = students.filter((student) => !student.excluded);
  if (!active.length) throw new Error('対象の生徒が0人です。');
  if (!groupIds.length || groupIds.length > active.length) throw new Error('グループ数は1以上、対象生徒数以下にしてください。');
  const activeIds = new Set(active.map((student) => student.id));
  const fixedCounts = new Map(groupIds.map((id) => [id, 0]));
  Object.entries(constraints.fixedByStudent).forEach(([studentId, groupId]) => {
    if (!activeIds.has(studentId)) return;
    if (!fixedCounts.has(groupId)) throw new Error('存在しないグループへ固定されています。');
    fixedCounts.set(groupId, (fixedCounts.get(groupId) ?? 0) + 1);
  });
  const maximum = Math.ceil(active.length / groupIds.length);
  if ([...fixedCounts.values()].some((count) => count > maximum)) throw new Error('固定された生徒数がグループの上限を超えています。');
  const base = Math.floor(active.length / groupIds.length);
  const extraCount = active.length % groupIds.length;
  if ([...fixedCounts.values()].filter((count) => count > base).length > extraCount) throw new Error('固定条件のままではグループ人数を均等にできません。');

  let best: GroupAssignmentResult | undefined;
  let executedAttempts = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    executedAttempts = attempt;
    const orderedGroups = shuffled(groupIds, source).sort((a, b) => (fixedCounts.get(b) ?? 0) - (fixedCounts.get(a) ?? 0));
    const capacity = new Map(orderedGroups.map((id, index) => [id, base + (index < extraCount ? 1 : 0)]));
    const result = Object.fromEntries(groupIds.map((id) => [id, []])) as Record<GroupId, StudentId[]>;
    Object.entries(constraints.fixedByStudent).forEach(([studentId, groupId]) => {
      if (activeIds.has(studentId)) result[groupId].push(studentId);
    });
    const fixedIds = new Set(Object.keys(constraints.fixedByStudent));
    const remaining = shuffled(active.filter((student) => !fixedIds.has(student.id)), source);
    remaining.forEach((student) => {
      const availableGroups = shuffled(groupIds.filter((id) => result[id].length < (capacity.get(id) ?? 0)), source);
      const scored = availableGroups.map((groupId) => ({
        groupId,
        conflicts: constraints.separationPairs.filter(
          (pair) =>
            (pair.studentAId === student.id && result[groupId].includes(pair.studentBId)) ||
            (pair.studentBId === student.id && result[groupId].includes(pair.studentAId)),
        ).length,
      }));
      scored.sort((a, b) => a.conflicts - b.conflicts);
      result[scored[0].groupId].push(student.id);
    });
    const evaluation = evaluateGroupAssignment(result, students, constraints);
    const candidate = { studentIdsByGroup: result, evaluation, attempts: attempt };
    if (!best || evaluation.coreScore < best.evaluation.coreScore) best = candidate;
    if (evaluation.coreScore === 0) break;
  }
  if (!best) throw new Error('グループ分け結果を作成できませんでした。');
  return { ...best, attempts: executedAttempts };
}

export function evaluateGroupAssignment(
  studentIdsByGroup: Record<GroupId, StudentId[]>,
  students: readonly Student[],
  constraints: GroupConstraints,
): AssignmentEvaluation {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const groupByStudent = new Map<StudentId, GroupId>();
  Object.entries(studentIdsByGroup).forEach(([groupId, ids]) => ids.forEach((id) => groupByStudent.set(id, groupId)));
  const violations: ConstraintViolation[] = [];
  const satisfiedConstraintIds: string[] = [];
  Object.entries(constraints.fixedByStudent).forEach(([studentId, groupId]) => {
    if (studentById.get(studentId)?.excluded) return;
    const id = `group-fixed:${studentId}`;
    if (groupByStudent.get(studentId) !== groupId) violations.push({ id, kind: 'fixed', studentIds: [studentId], message: `${studentById.get(studentId)?.name ?? '生徒'}が固定グループから移動しています。`, score: 1 });
    else satisfiedConstraintIds.push(id);
  });
  constraints.separationPairs.forEach((pair) => {
    if (studentById.get(pair.studentAId)?.excluded || studentById.get(pair.studentBId)?.excluded) return;
    if (groupByStudent.get(pair.studentAId) && groupByStudent.get(pair.studentAId) === groupByStudent.get(pair.studentBId)) {
      violations.push({ id: pair.id, kind: 'separation', studentIds: [pair.studentAId, pair.studentBId], message: `${studentById.get(pair.studentAId)?.name ?? '生徒'}と${studentById.get(pair.studentBId)?.name ?? '生徒'}が同じグループです。`, score: 1 });
    } else satisfiedConstraintIds.push(pair.id);
  });
  const sizes = Object.values(studentIdsByGroup).map((ids) => ids.length);
  if (sizes.length && Math.max(...sizes) - Math.min(...sizes) > 1) {
    violations.push({ id: 'group-balance', kind: 'group-balance', studentIds: [], message: 'グループの人数差が2人以上あります。', score: Math.max(...sizes) - Math.min(...sizes) - 1 });
  }
  return { coreScore: violations.reduce((sum, item) => sum + item.score, 0), historyScore: 0, violations, satisfiedConstraintIds };
}

export function assignOrder(
  students: readonly Student[],
  constraints: OrderConstraints,
  source?: RandomUint32Source,
): OrderAssignmentResult {
  const active = students.filter((student) => !student.excluded);
  if (!active.length) throw new Error('対象の生徒が0人です。');
  if (constraints.firstStudentId && constraints.firstStudentId === constraints.lastStudentId) throw new Error('同じ生徒を先頭と最後の両方へ固定できません。');
  const activeIds = new Set(active.map((student) => student.id));
  if (constraints.firstStudentId && !activeIds.has(constraints.firstStudentId)) throw new Error('先頭固定の生徒が対象外です。');
  if (constraints.lastStudentId && !activeIds.has(constraints.lastStudentId)) throw new Error('最後固定の生徒が対象外です。');
  const middle = shuffled(active.map((student) => student.id).filter((id) => id !== constraints.firstStudentId && id !== constraints.lastStudentId), source);
  return {
    orderedStudentIds: [constraints.firstStudentId, ...middle, constraints.lastStudentId].filter((id): id is string => Boolean(id)),
  };
}

function areAdjacent(a: Pick<Seat, 'row' | 'column'>, b: Pick<Seat, 'row' | 'column'>): boolean {
  const rowDistance = Math.abs(a.row - b.row);
  const columnDistance = Math.abs(a.column - b.column);
  return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
}

function isBetterEvaluation(candidate: AssignmentEvaluation, current: AssignmentEvaluation): boolean {
  return candidate.coreScore < current.coreScore || (candidate.coreScore === current.coreScore && candidate.historyScore < current.historyScore);
}

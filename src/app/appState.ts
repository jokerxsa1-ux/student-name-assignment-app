import { createSeats } from '../domain/assignment';
import type {
  GroupAssignmentResult,
  GroupConstraints,
  OrderAssignmentResult,
  OrderConstraints,
  Seat,
  SeatAssignmentResult,
  SeatConstraints,
  SeatHistoryEntry,
  Student,
} from '../domain/types';

export interface SeatModeState {
  rows: number;
  columns: number;
  seats: Seat[];
  constraints: SeatConstraints;
  result?: SeatAssignmentResult;
  printTitle: string;
  printDate: string;
}

export interface GroupModeState {
  count: number;
  constraints: GroupConstraints;
  result?: GroupAssignmentResult;
  printTitle: string;
  printDate: string;
}

export interface OrderModeState {
  constraints: OrderConstraints;
  result?: OrderAssignmentResult;
  printTitle: string;
  printDate: string;
}

export interface ProjectState {
  students: Student[];
  dummyDataLoaded: boolean;
  seatHistory: SeatHistoryEntry[];
  seats: SeatModeState;
  groups: GroupModeState;
  order: OrderModeState;
}

const today = new Date().toLocaleDateString('sv-SE');

export function createInitialProject(): ProjectState {
  return {
    students: [],
    dummyDataLoaded: false,
    seatHistory: [],
    seats: {
      rows: 5,
      columns: 6,
      seats: createSeats(5, 6),
      constraints: { fixedByStudent: {}, frontRowLimitByStudent: {}, separationPairs: [] },
      printTitle: '席替え結果',
      printDate: today,
    },
    groups: {
      count: 6,
      constraints: { fixedByStudent: {}, separationPairs: [] },
      printTitle: 'グループ分け結果',
      printDate: today,
    },
    order: {
      constraints: {},
      printTitle: '順番',
      printDate: today,
    },
  };
}

export function sanitizeProjectForRoster(project: ProjectState, students: Student[]): ProjectState {
  const ids = new Set(students.map((student) => student.id));
  const filterRecord = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([studentId]) => ids.has(studentId)));
  const filterPairs = <T extends { studentAId: string; studentBId: string }>(pairs: T[]) =>
    pairs.filter((pair) => ids.has(pair.studentAId) && ids.has(pair.studentBId));

  return {
    ...project,
    students,
    seats: {
      ...project.seats,
      constraints: {
        fixedByStudent: filterRecord(project.seats.constraints.fixedByStudent),
        frontRowLimitByStudent: filterRecord(project.seats.constraints.frontRowLimitByStudent),
        separationPairs: filterPairs(project.seats.constraints.separationPairs),
      },
      result: undefined,
    },
    groups: {
      ...project.groups,
      constraints: {
        fixedByStudent: filterRecord(project.groups.constraints.fixedByStudent),
        separationPairs: filterPairs(project.groups.constraints.separationPairs),
      },
      result: undefined,
    },
    order: {
      ...project.order,
      constraints: {
        firstStudentId: ids.has(project.order.constraints.firstStudentId ?? '')
          ? project.order.constraints.firstStudentId
          : undefined,
        lastStudentId: ids.has(project.order.constraints.lastStudentId ?? '')
          ? project.order.constraints.lastStudentId
          : undefined,
      },
      result: undefined,
    },
  };
}

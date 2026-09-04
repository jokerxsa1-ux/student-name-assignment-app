export type Mode = 'seats' | 'groups' | 'order';
export type StudentId = string;
export type SeatId = string;
export type GroupId = string;

export interface Student {
  id: StudentId;
  name: string;
  excluded: boolean;
}

export interface Seat {
  id: SeatId;
  row: number;
  column: number;
  enabled: boolean;
}

export interface SeparationPair {
  id: string;
  studentAId: StudentId;
  studentBId: StudentId;
}

export interface SeatConstraints {
  fixedByStudent: Record<StudentId, SeatId>;
  frontRowLimitByStudent: Record<StudentId, number>;
  separationPairs: SeparationPair[];
}

export interface GroupConstraints {
  fixedByStudent: Record<StudentId, GroupId>;
  separationPairs: SeparationPair[];
}

export interface OrderConstraints {
  firstStudentId?: StudentId;
  lastStudentId?: StudentId;
}

export type ViolationKind =
  | 'front-row'
  | 'separation'
  | 'fixed'
  | 'group-balance'
  | 'history-similarity';

export interface ConstraintViolation {
  id: string;
  kind: ViolationKind;
  studentIds: StudentId[];
  message: string;
  score: number;
}

export interface AssignmentEvaluation {
  coreScore: number;
  historyScore: number;
  violations: ConstraintViolation[];
  satisfiedConstraintIds: string[];
}

export interface SeatAssignmentResult {
  assignmentBySeat: Record<SeatId, StudentId | null>;
  evaluation: AssignmentEvaluation;
  attempts: number;
}

export interface GroupAssignmentResult {
  studentIdsByGroup: Record<GroupId, StudentId[]>;
  evaluation: AssignmentEvaluation;
  attempts: number;
}

export interface OrderAssignmentResult {
  orderedStudentIds: StudentId[];
}

export interface SeatHistoryEntry {
  id: string;
  createdAt: string;
  placementByStudent: Record<StudentId, { row: number; column: number }>;
}

export interface PersistedHistoryPayload {
  version: 1;
  roster: Student[];
  seatHistory: SeatHistoryEntry[];
  savedAt: string;
}

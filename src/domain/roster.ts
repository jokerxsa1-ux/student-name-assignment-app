import type { Student } from './types';

export function normalizeNames(input: string): string[] {
  return input
    .split(/\r?\n/u)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function createStudent(name: string): Student {
  return {
    id: createInternalId(),
    name: name.trim(),
    excluded: false,
  };
}

export function createStudents(names: readonly string[]): Student[] {
  return names.map(createStudent);
}

export function findDuplicateNames(students: readonly Student[]): Set<string> {
  const counts = new Map<string, number>();
  students.forEach((student) => counts.set(student.name, (counts.get(student.name) ?? 0) + 1));
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

export function displayName(student: Student, roster: readonly Student[]): string {
  const matches = roster.filter((candidate) => candidate.name === student.name);
  if (matches.length < 2) return student.name;
  return `${student.name} (${matches.findIndex((candidate) => candidate.id === student.id) + 1})`;
}

export function createInternalId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('内部IDを生成できません。');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

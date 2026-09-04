import { DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import type { GroupModeState } from '../app/appState';
import { assignGroups, evaluateGroupAssignment } from '../domain/assignment';
import { displayName } from '../domain/roster';
import type { Student } from '../domain/types';
import { DraggableName, DroppableArea } from './DndPrimitives';
import { PairEditor } from './PairEditor';
import { ResultMessages } from './ResultMessages';
import { EmptyResult, PrintControls } from './SeatMode';
import styles from '../styles/App.module.css';

interface Props {
  students: Student[];
  state: GroupModeState;
  onChange: (state: GroupModeState) => void;
}

export function GroupMode({ students, state, onChange }: Props) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = students.filter((student) => !student.excluded);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const groupIds = Array.from({ length: state.count }, (_, index) => `g${index + 1}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const baseSize = state.count > 0 ? Math.floor(active.length / state.count) : 0;
  const extra = state.count > 0 ? active.length % state.count : 0;

  const setCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(20, count));
    const validGroups = new Set(Array.from({ length: nextCount }, (_, index) => `g${index + 1}`));
    onChange({
      ...state,
      count: nextCount,
      constraints: {
        ...state.constraints,
        fixedByStudent: Object.fromEntries(Object.entries(state.constraints.fixedByStudent).filter(([, groupId]) => validGroups.has(groupId))),
      },
      result: undefined,
    });
  };

  const run = () => {
    setError('');
    setNotice('');
    try {
      const result = assignGroups(students, groupIds, state.constraints);
      onChange({ ...state, result });
      setNotice(result.evaluation.coreScore ? '最も条件に近いグループを作成しました。' : 'すべての条件を満たすグループを作成しました。');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'グループを作成できませんでした。');
    }
  };

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || !state.result) return;
    const studentId = String(dragged.id).replace(/^student:/u, '');
    const targetGroupId = String(over.id).replace(/^group:/u, '');
    if (!groupIds.includes(targetGroupId)) return;
    const sourceGroupId = Object.entries(state.result.studentIdsByGroup).find(([, ids]) => ids.includes(studentId))?.[0];
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    const fixedGroup = state.constraints.fixedByStudent[studentId];
    if (fixedGroup && fixedGroup !== targetGroupId && !window.confirm('固定グループから移動します。条件違反として表示されますが、移動しますか？')) return;
    const studentIdsByGroup = Object.fromEntries(
      Object.entries(state.result.studentIdsByGroup).map(([groupId, ids]) => [groupId, ids.filter((id) => id !== studentId)]),
    );
    studentIdsByGroup[targetGroupId] = [...studentIdsByGroup[targetGroupId], studentId];
    const evaluation = evaluateGroupAssignment(studentIdsByGroup, students, state.constraints);
    onChange({ ...state, result: { ...state.result, studentIdsByGroup, evaluation } });
  };

  return (
    <div className={styles.modeLayout}>
      <section className={styles.panel} aria-labelledby="group-settings-heading">
        <p className={styles.eyebrow}>グループ分け</p>
        <h2 id="group-settings-heading">グループと条件</h2>
        <div className={styles.dimensionRow}>
          <label>グループ数<input type="number" min="1" max="20" value={state.count} onChange={(event) => setCount(Number(event.target.value))} /></label>
          <button type="button" className={styles.smallButton} onClick={() => setCount(6)}>6グループ</button>
        </div>
        <p className={styles.counterLine}>
          {state.count > active.length && active.length > 0
            ? 'グループ数が対象人数を超えています'
            : `${baseSize}人のグループ${state.count - extra}組${extra ? `、${baseSize + 1}人のグループ${extra}組` : ''}`}
        </p>

        <details className={styles.constraintDetails}>
          <summary>特定のグループへ固定</summary>
          <div className={styles.studentConstraintList}>
            {active.map((student) => (
              <div className={styles.studentConstraintRow} key={student.id}>
                <strong>{displayName(student, students)}</strong>
                <label>グループ
                  <select
                    value={state.constraints.fixedByStudent[student.id] ?? ''}
                    onChange={(event) => {
                      const fixedByStudent = { ...state.constraints.fixedByStudent };
                      if (event.target.value) fixedByStudent[student.id] = event.target.value;
                      else delete fixedByStudent[student.id];
                      onChange({ ...state, constraints: { ...state.constraints, fixedByStudent }, result: undefined });
                    }}
                  >
                    <option value="">指定なし</option>
                    {groupIds.map((groupId, index) => <option key={groupId} value={groupId}>グループ {index + 1}</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </details>
        <PairEditor
          students={students}
          pairs={state.constraints.separationPairs}
          mode="groups"
          onChange={(separationPairs) => onChange({ ...state, constraints: { ...state.constraints, separationPairs }, result: undefined })}
        />
        <button className={styles.primaryButton} type="button" onClick={run}>自動割り当て</button>
        {error && <div className={styles.errorBox} role="alert">{error}</div>}
      </section>

      <section className={`${styles.panel} ${styles.resultPanel} ${styles.portraitPrint}`} aria-labelledby="group-result-heading">
        <div className={styles.resultHeader}>
          <div><p className={styles.eyebrow}>割り当て結果</p><h2 id="group-result-heading">グループ</h2></div>
          {state.result && <span className={styles.attemptBadge}>{state.result.attempts}回探索</span>}
        </div>
        {notice && <p className={styles.successMessage} aria-live="polite">{notice}</p>}
        {state.result ? (
          <>
            <PrintControls title={state.printTitle} date={state.printDate} onChange={(values) => onChange({ ...state, ...values })} />
            <div className={styles.printHeading}><h1>{state.printTitle}</h1><time>{state.printDate}</time></div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className={`${styles.groupGrid} ${styles.placementAnimation}`}>
                {groupIds.map((groupId, index) => {
                  const ids = state.result?.studentIdsByGroup[groupId] ?? [];
                  return (
                    <DroppableArea id={`group:${groupId}`} key={groupId} className={styles.groupCard}>
                      <div className={styles.groupTitle}><h3>グループ {index + 1}</h3><span>{ids.length}人</span></div>
                      <div className={styles.groupMembers}>
                        {ids.map((studentId) => {
                          const student = studentById.get(studentId);
                          if (!student) return null;
                          const fixed = state.constraints.fixedByStudent[studentId] === groupId;
                          return <DraggableName id={`student:${studentId}`} key={studentId}>{displayName(student, students)}{fixed && <small>固定</small>}</DraggableName>;
                        })}
                      </div>
                    </DroppableArea>
                  );
                })}
              </div>
            </DndContext>
            <ResultMessages evaluation={state.result.evaluation} />
            <div className={`${styles.buttonRow} ${styles.noPrint}`}>
              <button type="button" className={styles.secondaryButton} onClick={run}>同じ条件で再編成</button>
              <button type="button" className={styles.printButton} onClick={() => window.print()}>印刷・PDF保存</button>
            </div>
          </>
        ) : <EmptyResult text="人数と条件を設定すると、均等なグループをここに表示します。" />}
      </section>
    </div>
  );
}

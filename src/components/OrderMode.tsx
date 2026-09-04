import { DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import type { OrderModeState } from '../app/appState';
import { assignOrder } from '../domain/assignment';
import { displayName } from '../domain/roster';
import type { Student } from '../domain/types';
import { EmptyResult, PrintControls } from './SeatMode';
import styles from '../styles/App.module.css';

interface Props {
  students: Student[];
  state: OrderModeState;
  onChange: (state: OrderModeState) => void;
}

export function OrderMode({ students, state, onChange }: Props) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = students.filter((student) => !student.excluded);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const run = () => {
    setError('');
    try {
      onChange({ ...state, result: assignOrder(students, state.constraints) });
      setNotice('新しい順番を作成しました。');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '順番を作成できませんでした。');
    }
  };

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || !state.result || dragged.id === over.id) return;
    const current = state.result.orderedStudentIds;
    const oldIndex = current.indexOf(String(dragged.id));
    const newIndex = current.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...state, result: { orderedStudentIds: arrayMove(current, oldIndex, newIndex) } });
  };

  return (
    <div className={styles.modeLayout}>
      <section className={styles.panel} aria-labelledby="order-settings-heading">
        <p className={styles.eyebrow}>順番決め</p>
        <h2 id="order-settings-heading">順番の条件</h2>
        <p className={styles.leadText}>発表順、面談順、実技試験順などを公平に決められます。</p>
        <label className={styles.fieldLabel}>先頭へ固定
          <select
            value={state.constraints.firstStudentId ?? ''}
            onChange={(event) => onChange({ ...state, constraints: { ...state.constraints, firstStudentId: event.target.value || undefined }, result: undefined })}
          >
            <option value="">指定なし</option>
            {active.map((student) => <option key={student.id} value={student.id}>{displayName(student, students)}</option>)}
          </select>
        </label>
        <label className={styles.fieldLabel}>最後へ固定
          <select
            value={state.constraints.lastStudentId ?? ''}
            onChange={(event) => onChange({ ...state, constraints: { ...state.constraints, lastStudentId: event.target.value || undefined }, result: undefined })}
          >
            <option value="">指定なし</option>
            {active.map((student) => <option key={student.id} value={student.id}>{displayName(student, students)}</option>)}
          </select>
        </label>
        <button className={styles.primaryButton} type="button" onClick={run}>自動割り当て</button>
        {error && <div className={styles.errorBox} role="alert">{error}</div>}
      </section>

      <section className={`${styles.panel} ${styles.resultPanel} ${styles.portraitPrint}`} aria-labelledby="order-result-heading">
        <div className={styles.resultHeader}><div><p className={styles.eyebrow}>割り当て結果</p><h2 id="order-result-heading">順番</h2></div></div>
        {notice && <p className={styles.successMessage} aria-live="polite">{notice}</p>}
        {state.result ? (
          <>
            <PrintControls title={state.printTitle} date={state.printDate} onChange={(values) => onChange({ ...state, ...values })} />
            <div className={styles.printHeading}><h1>{state.printTitle}</h1><time>{state.printDate}</time></div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={state.result.orderedStudentIds} strategy={verticalListSortingStrategy}>
                <ol className={`${styles.orderList} ${styles.placementAnimation}`}>
                  {state.result.orderedStudentIds.map((studentId, index) => {
                    const student = studentById.get(studentId);
                    return student ? <SortableOrderItem key={studentId} id={studentId} index={index} name={displayName(student, students)} /> : null;
                  })}
                </ol>
              </SortableContext>
            </DndContext>
            <div className={`${styles.buttonRow} ${styles.noPrint}`}>
              <button type="button" className={styles.secondaryButton} onClick={run}>もう一度決める</button>
              <button type="button" className={styles.printButton} onClick={() => window.print()}>印刷・PDF保存</button>
            </div>
          </>
        ) : <EmptyResult text="対象者からランダムな順番を作成します。" />}
      </section>
    </div>
  );
}

function SortableOrderItem({ id, index, name }: { id: string; index: number; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <li ref={setNodeRef} style={style}>
      <span className={styles.orderNumber}>{index + 1}</span>
      <span>{name}</span>
      <button type="button" className={styles.dragHandle} {...attributes} {...listeners} aria-label={`${name}を並べ替え`}>移動</button>
    </li>
  );
}

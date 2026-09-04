import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { appConfig } from '../appConfig';
import type { SeatModeState } from '../app/appState';
import { assignSeats, createSeatHistory, createSeats, evaluateSeatAssignment } from '../domain/assignment';
import { displayName } from '../domain/roster';
import type { SeatHistoryEntry, Student } from '../domain/types';
import { DraggableName, DroppableArea } from './DndPrimitives';
import { PairEditor } from './PairEditor';
import { ResultMessages } from './ResultMessages';
import styles from '../styles/App.module.css';

interface Props {
  students: Student[];
  state: SeatModeState;
  history: SeatHistoryEntry[];
  onChange: (state: SeatModeState) => void;
  onRecordHistory: (history: SeatHistoryEntry) => void;
}

export function SeatMode({ students, state, history, onChange, onRecordHistory }: Props) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = students.filter((student) => !student.excluded);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const enabledSeats = state.seats.filter((seat) => seat.enabled);

  const setDimensions = (rows: number, columns: number) => {
    const nextRows = Math.max(1, Math.min(appConfig.maxRows, rows));
    const nextColumns = Math.max(1, Math.min(appConfig.maxColumns, columns));
    onChange({
      ...state,
      rows: nextRows,
      columns: nextColumns,
      seats: createSeats(nextRows, nextColumns),
      constraints: { ...state.constraints, fixedByStudent: {} },
      result: undefined,
    });
  };

  const run = () => {
    setError('');
    setNotice('');
    try {
      const result = assignSeats(students, state.seats, state.constraints, history);
      onChange({ ...state, result });
      setNotice(result.evaluation.coreScore || result.evaluation.historyScore ? '最も条件に近い配置を作成しました。' : 'すべての条件を満たす配置を作成しました。');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '席を割り当てられませんでした。');
    }
  };

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || !state.result) return;
    const targetSeatId = String(over.id).replace(/^seat:/u, '');
    const studentId = String(dragged.id).replace(/^student:/u, '');
    const sourceSeatId = Object.entries(state.result.assignmentBySeat).find(([, id]) => id === studentId)?.[0];
    if (!sourceSeatId || !state.result.assignmentBySeat.hasOwnProperty(targetSeatId) || sourceSeatId === targetSeatId) return;
    const fixedSeat = state.constraints.fixedByStudent[studentId];
    if (fixedSeat && fixedSeat !== targetSeatId && !window.confirm('固定席から移動します。条件違反として表示されますが、移動しますか？')) return;
    const assignmentBySeat = { ...state.result.assignmentBySeat };
    const targetStudent = assignmentBySeat[targetSeatId];
    assignmentBySeat[targetSeatId] = studentId;
    assignmentBySeat[sourceSeatId] = targetStudent;
    const evaluation = evaluateSeatAssignment(assignmentBySeat, students, state.seats, state.constraints, history);
    onChange({ ...state, result: { ...state.result, assignmentBySeat, evaluation } });
  };

  return (
    <div className={styles.modeLayout}>
      <section className={styles.panel} aria-labelledby="seat-settings-heading">
        <p className={styles.eyebrow}>席替え</p>
        <h2 id="seat-settings-heading">座席と条件</h2>
        <div className={styles.dimensionRow}>
          <label>前後の行数<input type="number" min="1" max={appConfig.maxRows} value={state.rows} onChange={(event) => setDimensions(Number(event.target.value), state.columns)} /></label>
          <span>×</span>
          <label>左右の列数<input type="number" min="1" max={appConfig.maxColumns} value={state.columns} onChange={(event) => setDimensions(state.rows, Number(event.target.value))} /></label>
          <button type="button" className={styles.smallButton} onClick={() => setDimensions(5, 6)}>5×6</button>
        </div>
        <p className={styles.counterLine}>対象 {active.length}人 / 有効席 {enabledSeats.length}席</p>
        <div className={styles.miniLectern}>教卓</div>
        <div className={styles.seatSetupGrid} style={{ gridTemplateColumns: `repeat(${state.columns}, minmax(34px, 1fr))` }}>
          {state.seats.map((seat) => (
            <button
              type="button"
              key={seat.id}
              className={seat.enabled ? styles.setupSeat : styles.disabledSeat}
              aria-pressed={!seat.enabled}
              onClick={() => onChange({ ...state, seats: state.seats.map((item) => item.id === seat.id ? { ...item, enabled: !item.enabled } : item), result: undefined })}
            >{seat.enabled ? `${seat.row + 1}-${seat.column + 1}` : '使用しない'}</button>
          ))}
        </div>

        <details className={styles.constraintDetails}>
          <summary>固定席・前方指定</summary>
          <div className={styles.studentConstraintList}>
            {active.map((student) => (
              <div className={styles.studentConstraintRow} key={student.id}>
                <strong>{displayName(student, students)}</strong>
                <label>固定席
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
                    {enabledSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.row + 1}行 {seat.column + 1}列</option>)}
                  </select>
                </label>
                <label>前方
                  <select
                    value={state.constraints.frontRowLimitByStudent[student.id] ?? ''}
                    onChange={(event) => {
                      const frontRowLimitByStudent = { ...state.constraints.frontRowLimitByStudent };
                      if (event.target.value) frontRowLimitByStudent[student.id] = Number(event.target.value);
                      else delete frontRowLimitByStudent[student.id];
                      onChange({ ...state, constraints: { ...state.constraints, frontRowLimitByStudent }, result: undefined });
                    }}
                  >
                    <option value="">指定なし</option>
                    {Array.from({ length: state.rows }, (_, index) => <option key={index + 1} value={index + 1}>前から{index + 1}行以内</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </details>

        <PairEditor
          students={students}
          pairs={state.constraints.separationPairs}
          mode="seats"
          onChange={(separationPairs) => onChange({ ...state, constraints: { ...state.constraints, separationPairs }, result: undefined })}
        />
        <button className={styles.primaryButton} type="button" onClick={run}>自動割り当て</button>
        {error && <div className={styles.errorBox} role="alert">{error}</div>}
      </section>

      <section className={`${styles.panel} ${styles.resultPanel} ${styles.seatPrint}`} aria-labelledby="seat-result-heading">
        <div className={styles.resultHeader}>
          <div><p className={styles.eyebrow}>割り当て結果</p><h2 id="seat-result-heading">座席表</h2></div>
          {state.result && <span className={styles.attemptBadge}>{state.result.attempts}回探索</span>}
        </div>
        {notice && <p className={styles.successMessage} aria-live="polite">{notice}</p>}
        {state.result ? (
          <>
            <PrintControls title={state.printTitle} date={state.printDate} onChange={(values) => onChange({ ...state, ...values })} />
            <div className={styles.printHeading}><h1>{state.printTitle}</h1><time>{state.printDate}</time></div>
            <div className={styles.lectern}>教卓</div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className={`${styles.seatResultGrid} ${styles.placementAnimation}`} style={{ gridTemplateColumns: `repeat(${state.columns}, minmax(70px, 1fr))` }}>
                {state.seats.map((seat) => {
                  if (!seat.enabled) return <div key={seat.id} className={styles.resultDisabledSeat}>使用しない</div>;
                  const studentId = state.result?.assignmentBySeat[seat.id];
                  const student = studentId ? studentById.get(studentId) : undefined;
                  const fixed = studentId && state.constraints.fixedByStudent[studentId] === seat.id;
                  return (
                    <DroppableArea id={`seat:${seat.id}`} key={seat.id} className={`${styles.resultSeat} ${fixed ? styles.fixedSeat : ''}`}>
                      <span className={styles.seatNumber}>{seat.row + 1}-{seat.column + 1}</span>
                      {student ? <DraggableName id={`student:${student.id}`}>{displayName(student, students)}{fixed && <small>固定</small>}</DraggableName> : <span className={styles.emptySeat}>空席</span>}
                    </DroppableArea>
                  );
                })}
              </div>
            </DndContext>
            <ResultMessages evaluation={state.result.evaluation} />
            <div className={`${styles.buttonRow} ${styles.noPrint}`}>
              <button type="button" className={styles.secondaryButton} onClick={run}>同じ条件で再配置</button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  onRecordHistory(createSeatHistory(state.result!, state.seats));
                  setNotice('この配置を席履歴へ登録しました。');
                }}
              >この配置を履歴へ登録</button>
              <button type="button" className={styles.printButton} onClick={() => window.print()}>印刷・PDF保存</button>
            </div>
          </>
        ) : <EmptyResult text="条件を設定して「自動割り当て」を押すと、ここに座席表が表示されます。" />}
      </section>
    </div>
  );
}

function PrintControls({ title, date, onChange }: { title: string; date: string; onChange: (values: { printTitle?: string; printDate?: string }) => void }) {
  return (
    <div className={`${styles.printControls} ${styles.noPrint}`}>
      <label>印刷タイトル<input value={title} onChange={(event) => onChange({ printTitle: event.target.value })} /></label>
      <label>日付<input type="date" value={date} onChange={(event) => onChange({ printDate: event.target.value })} /></label>
    </div>
  );
}

function EmptyResult({ text }: { text: string }) {
  return <div className={styles.emptyResult}><span aria-hidden="true">◇</span><p>{text}</p></div>;
}

export { EmptyResult, PrintControls };

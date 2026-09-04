import { useState } from 'react';
import { createInternalId, displayName } from '../domain/roster';
import type { SeparationPair, Student } from '../domain/types';
import styles from '../styles/App.module.css';

interface Props {
  students: Student[];
  pairs: SeparationPair[];
  mode: 'seats' | 'groups';
  onChange: (pairs: SeparationPair[]) => void;
}

export function PairEditor({ students, pairs, mode, onChange }: Props) {
  const active = students.filter((student) => !student.excluded);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const label = mode === 'seats' ? '隣り合わせにしない' : '同じグループにしない';

  const add = () => {
    if (!first || !second || first === second) {
      setError('異なる2人を選んでください。');
      return;
    }
    if (pairs.some((pair) =>
      (pair.studentAId === first && pair.studentBId === second) ||
      (pair.studentAId === second && pair.studentBId === first))) {
      setError('この組み合わせは登録済みです。');
      return;
    }
    onChange([...pairs, { id: createInternalId(), studentAId: first, studentBId: second }]);
    setFirst('');
    setSecond('');
    setError('');
  };

  const name = (id: string) => {
    const student = students.find((item) => item.id === id);
    return student ? displayName(student, students) : '不明';
  };

  return (
    <div className={styles.constraintBlock}>
      <h3>{label}</h3>
      <div className={styles.pairControls}>
        <select aria-label="1人目" value={first} onChange={(event) => setFirst(event.target.value)}>
          <option value="">1人目を選択</option>
          {active.map((student) => <option key={student.id} value={student.id}>{displayName(student, students)}</option>)}
        </select>
        <span>と</span>
        <select aria-label="2人目" value={second} onChange={(event) => setSecond(event.target.value)}>
          <option value="">2人目を選択</option>
          {active.map((student) => <option key={student.id} value={student.id}>{displayName(student, students)}</option>)}
        </select>
        <button type="button" className={styles.smallButton} onClick={add}>追加</button>
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
      {pairs.length > 0 && (
        <ul className={styles.conditionList}>
          {pairs.map((pair) => (
            <li key={pair.id}>
              <span>{name(pair.studentAId)} と {name(pair.studentBId)}</span>
              <button type="button" onClick={() => onChange(pairs.filter((item) => item.id !== pair.id))}>解除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

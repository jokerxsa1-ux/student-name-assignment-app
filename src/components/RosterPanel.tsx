import { useMemo, useState } from 'react';
import { appConfig, dummyNames } from '../appConfig';
import { createStudents, findDuplicateNames, normalizeNames } from '../domain/roster';
import type { Student } from '../domain/types';
import styles from '../styles/App.module.css';

interface Props {
  students: Student[];
  dummyDataLoaded: boolean;
  onChange: (students: Student[], dummyDataLoaded?: boolean) => void;
}

export function RosterPanel({ students, dummyDataLoaded, onChange }: Props) {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const duplicates = useMemo(() => findDuplicateNames(students), [students]);
  const activeCount = students.filter((student) => !student.excluded).length;

  const importNames = () => {
    const names = normalizeNames(input);
    if (!names.length) {
      setMessage('1行につき1人の名前を入力してください。');
      return;
    }
    if (students.length + names.length > appConfig.maxStudents) {
      setMessage(`名簿は最大${appConfig.maxStudents}人です。`);
      return;
    }
    onChange([...students, ...createStudents(names)], false);
    setInput('');
    setMessage(`${names.length}人を名簿へ追加しました。`);
  };

  const loadDummy = () => {
    if (students.length && !window.confirm('現在の名簿を撮影用の架空データへ置き換えますか？')) return;
    onChange(createStudents(dummyNames), true);
    setMessage('撮影用の架空データ30人を読み込みました。');
  };

  return (
    <section className={styles.panel} aria-labelledby="roster-heading">
      <div className={styles.sectionHeadingRow}>
        <div>
          <p className={styles.eyebrow}>共通名簿</p>
          <h2 id="roster-heading">生徒を登録</h2>
        </div>
        <span className={styles.countBadge}>対象 {activeCount}人 / 全{students.length}人</span>
      </div>

      {dummyDataLoaded && <div className={styles.dummyBadge}>撮影用・架空データ</div>}

      <label className={styles.fieldLabel} htmlFor="roster-input">1行につき1人の名前</label>
      <textarea
        id="roster-input"
        className={styles.rosterInput}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={5}
        placeholder={'児童01\n児童02\n児童03'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className={styles.buttonRow}>
        <button className={styles.secondaryButton} type="button" onClick={importNames}>名簿へ追加</button>
        <button className={styles.ghostButton} type="button" onClick={loadDummy}>ダミー30人</button>
      </div>
      {message && <p className={styles.inlineMessage} aria-live="polite">{message}</p>}
      {duplicates.size > 0 && (
        <div className={styles.warningBox} role="status">
          <strong>同じ名前があります</strong>
          <span>{[...duplicates].join('、')}。内部では別の生徒として扱います。</span>
        </div>
      )}

      {students.length > 0 && (
        <div className={styles.rosterList} aria-label="生徒一覧">
          {students.map((student) => (
            <div className={`${styles.rosterRow} ${student.excluded ? styles.excludedRow : ''}`} key={student.id}>
              <input
                aria-label={`${student.name}の名前`}
                value={student.name}
                onChange={(event) => onChange(students.map((item) => item.id === student.id ? { ...item, name: event.target.value } : item), false)}
                autoComplete="off"
                spellCheck={false}
              />
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={student.excluded}
                  onChange={() => onChange(students.map((item) => item.id === student.id ? { ...item, excluded: !item.excluded } : item), dummyDataLoaded)}
                />
                除外
              </label>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={`${student.name}を削除`}
                onClick={() => onChange(students.filter((item) => item.id !== student.id), dummyDataLoaded)}
              >削除</button>
            </div>
          ))}
        </div>
      )}

      {students.some((student) => student.excluded) && (
        <button
          className={styles.textButton}
          type="button"
          onClick={() => onChange(students.map((student) => ({ ...student, excluded: false })), dummyDataLoaded)}
        >全員を対象へ戻す</button>
      )}
      {students.length > 0 && (
        <button
          className={styles.dangerButton}
          type="button"
          onClick={() => {
            if (window.confirm('名簿・条件・結果をすべて削除しますか？')) onChange([], false);
          }}
        >全データ削除</button>
      )}
    </section>
  );
}

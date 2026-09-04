import { useEffect, useState } from 'react';
import { appConfig } from './appConfig';
import { createInitialProject, sanitizeProjectForRoster, type ProjectState } from './app/appState';
import { useUndoableProject } from './app/useUndoableProject';
import { GroupMode } from './components/GroupMode';
import { HistoryPanel } from './components/HistoryPanel';
import { OrderMode } from './components/OrderMode';
import { RosterPanel } from './components/RosterPanel';
import { SeatMode } from './components/SeatMode';
import { sameSeatPlacement } from './domain/assignment';
import type { Mode, PersistedHistoryPayload, SeatHistoryEntry, Student } from './domain/types';
import {
  decryptHistory,
  deleteEncryptedHistory,
  encryptHistory,
  loadEncryptedHistory,
  saveEncryptedHistory,
} from './infrastructure/historyStorage';
import styles from './styles/App.module.css';

export default function App() {
  const [page, setPage] = useState<'roster' | 'assignment'>('roster');
  const [mode, setMode] = useState<Mode>('seats');
  const { project, updateProject, replaceProject, undo, redo, canUndo, canRedo } = useUndoableProject();
  const [hasSavedData, setHasSavedData] = useState(false);
  const [historyPassphrase, setHistoryPassphrase] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    let active = true;
    void loadEncryptedHistory().then((record) => {
      if (active) setHasSavedData(Boolean(record));
    }).catch(() => {
      if (active) setSaveStatus('端末内の保存領域を確認できませんでした。');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!project.students.length) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [project.students.length]);

  useEffect(() => {
    if (!historyPassphrase) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const payload = createPersistedPayload(project);
      void encryptHistory(payload, historyPassphrase)
        .then(saveEncryptedHistory)
        .then(() => {
          if (!cancelled) {
            setHasSavedData(true);
            setSaveStatus('端末内へ暗号化して保存しました。');
          }
        })
        .catch(() => {
          if (!cancelled) setSaveStatus('暗号化履歴を保存できませんでした。ブラウザ設定を確認してください。');
        });
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [historyPassphrase, project.students, project.seatHistory]);

  useEffect(() => {
    if (!historyPassphrase) return;
    let timer = window.setTimeout(() => setHistoryPassphrase(''), appConfig.autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHistoryPassphrase(''), appConfig.autoLockMinutes * 60_000);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [historyPassphrase]);

  const changeRoster = (students: Student[], dummyDataLoaded = false) => {
    updateProject((current) => {
      const next = sanitizeProjectForRoster(current, students);
      return { ...next, dummyDataLoaded, seatHistory: students.length ? next.seatHistory : [] };
    });
  };

  const enableHistory = async (passphrase: string) => {
    setHistoryBusy(true);
    try {
      const record = await encryptHistory(createPersistedPayload(project), passphrase);
      await saveEncryptedHistory(record);
      setHistoryPassphrase(passphrase);
      setHasSavedData(true);
      setSaveStatus('暗号化保存を有効にしました。');
    } finally {
      setHistoryBusy(false);
    }
  };

  const unlockHistory = async (passphrase: string) => {
    setHistoryBusy(true);
    try {
      const record = await loadEncryptedHistory();
      if (!record) throw new Error('保存履歴が見つかりません。');
      const payload = await decryptHistory(record, passphrase);
      const restored = sanitizeProjectForRoster(
        { ...createInitialProject(), seatHistory: payload.seatHistory.slice(0, appConfig.historyLimit) },
        payload.roster,
      );
      replaceProject(restored);
      setHistoryPassphrase(passphrase);
      setSaveStatus('暗号化した名簿と席履歴を読み込みました。');
    } finally {
      setHistoryBusy(false);
    }
  };

  const deleteHistory = async () => {
    setHistoryBusy(true);
    try {
      await deleteEncryptedHistory();
      setHistoryPassphrase('');
      setHasSavedData(false);
      updateProject((current) => ({ ...current, seatHistory: [] }));
      setSaveStatus('端末内の暗号化履歴を削除しました。');
    } finally {
      setHistoryBusy(false);
    }
  };

  const recordHistory = (entry: SeatHistoryEntry) => {
    updateProject((current) => ({
      ...current,
      seatHistory: [
        entry,
        ...current.seatHistory.filter((history) => !sameSeatPlacement(history.placementByStudent, entry.placementByStudent)),
      ].slice(0, appConfig.historyLimit),
    }));
  };

  return (
    <div className={styles.appShell}>
      <header className={styles.appHeader}>
        <div>
          <p className={styles.brandKicker}>先生のためのブラウザ内ツール</p>
          <h1>{appConfig.appName}</h1>
          <p>名簿を貼り付けて、席・グループ・順番をすぐに作成できます。</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.undoControls} aria-label="操作履歴">
            <button type="button" onClick={undo} disabled={!canUndo}>元に戻す</button>
            <button type="button" onClick={redo} disabled={!canRedo}>やり直す</button>
          </div>
        </div>
      </header>

      <div className={styles.privacyNotice}>
        <span aria-hidden="true">●</span>
        <p>{appConfig.privacyNotice}</p>
      </div>

      <nav className={styles.pageTabs} aria-label="ページ">
        {([
          ['roster', '1. 名簿登録'],
          ['assignment', '2. 割り当て'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={page === value ? styles.activePageTab : ''} aria-current={page === value ? 'page' : undefined} onClick={() => setPage(value)}>
            {label}
          </button>
        ))}
      </nav>

      {page === 'roster' ? (
        <main className={styles.rosterPage}>
          <div className={styles.pageIntroduction}>
            <p className={styles.eyebrow}>STEP 1</p>
            <h2>名簿をつくる</h2>
            <p>生徒名を登録し、必要であればこの端末へ暗号化して保存します。</p>
          </div>
          <div className={styles.rosterPageGrid}>
            <RosterPanel students={project.students} dummyDataLoaded={project.dummyDataLoaded} onChange={changeRoster} />
            <div className={styles.historyColumn}>
              <HistoryPanel
                hasSavedData={hasSavedData}
                unlocked={Boolean(historyPassphrase)}
                busy={historyBusy}
                historyCount={project.seatHistory.length}
                onEnable={enableHistory}
                onUnlock={unlockHistory}
                onLock={() => {
                  setHistoryPassphrase('');
                  setSaveStatus('暗号化履歴をロックしました。');
                }}
                onDelete={deleteHistory}
              />
              {saveStatus && <p className={styles.saveStatus} aria-live="polite">{saveStatus}</p>}
            </div>
          </div>
          <div className={styles.nextStepBar}>
            <div>
              <strong>対象 {project.students.filter((student) => !student.excluded).length}人</strong>
              <span>名簿の準備ができたら割り当てへ進みます。</span>
            </div>
            <button type="button" className={styles.nextStepButton} disabled={!project.students.length} onClick={() => setPage('assignment')}>
              割り当てへ進む →
            </button>
          </div>
        </main>
      ) : (
        <>
          <nav className={styles.modeTabs} aria-label="割り当てモード">
            {([
              ['seats', '席替え', '▦'],
              ['groups', 'グループ分け', '◫'],
              ['order', '順番決め', '≡'],
            ] as const).map(([value, label, icon]) => (
              <button key={value} type="button" className={mode === value ? styles.activeTab : ''} aria-current={mode === value ? 'page' : undefined} onClick={() => setMode(value)}>
                <span aria-hidden="true">{icon}</span>{label}
              </button>
            ))}
          </nav>
          <main className={styles.assignmentWorkspace}>
            {mode === 'seats' && (
              <SeatMode
                students={project.students}
                state={project.seats}
                history={project.seatHistory}
                onChange={(seats) => updateProject((current) => ({ ...current, seats }))}
                onRecordHistory={recordHistory}
              />
            )}
            {mode === 'groups' && (
              <GroupMode
                students={project.students}
                state={project.groups}
                onChange={(groups) => updateProject((current) => ({ ...current, groups }))}
              />
            )}
            {mode === 'order' && (
              <OrderMode
                students={project.students}
                state={project.order}
                onChange={(order) => updateProject((current) => ({ ...current, order }))}
              />
            )}
          </main>
        </>
      )}

      <footer className={styles.appFooter}>
        入力内容はこのブラウザ内で処理されます。共有端末では、利用後に全データを削除してください。
        <span>バージョン {appConfig.version}</span>
      </footer>
    </div>
  );
}

function createPersistedPayload(project: ProjectState): PersistedHistoryPayload {
  return {
    version: 1,
    roster: project.students,
    seatHistory: project.seatHistory.slice(0, appConfig.historyLimit),
    savedAt: new Date().toISOString(),
  };
}

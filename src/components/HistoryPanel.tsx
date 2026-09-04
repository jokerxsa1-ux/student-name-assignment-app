import { useState } from 'react';
import styles from '../styles/App.module.css';

interface Props {
  hasSavedData: boolean;
  unlocked: boolean;
  busy: boolean;
  historyCount: number;
  onEnable: (passphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
  onLock: () => void;
  onDelete: () => Promise<void>;
}

export function HistoryPanel({ hasSavedData, unlocked, busy, historyCount, onEnable, onUnlock, onLock, onDelete }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      if (hasSavedData) {
        await onUnlock(passphrase);
      } else {
        if (passphrase !== confirmation) throw new Error('確認用のパスフレーズが一致しません。');
        await onEnable(passphrase);
      }
      setPassphrase('');
      setConfirmation('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '履歴を処理できませんでした。');
    }
  };

  return (
    <details className={styles.historyPanel}>
      <summary>直近2回の席履歴・端末内保存</summary>
      <p>席履歴は現在{historyCount}件です。同じ席は2点、隣接席は1点として、通常条件を守れる候補の中から似ていない配置を選びます。</p>
      {!hasSavedData && !unlocked && (
        <div className={styles.infoBox}>
          <strong>端末内保存は任意です</strong>
          <span>共有端末では有効にしないでください。名簿と直近2回だけを暗号化して保存し、外部へは送信しません。</span>
        </div>
      )}
      {unlocked ? (
        <div className={styles.buttonRow}>
          <span className={styles.successBadge}>暗号化保存：有効</span>
          <button type="button" className={styles.ghostButton} onClick={onLock}>ロック</button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => {
              if (window.confirm('この端末に保存した名簿と席履歴を完全に削除しますか？')) void onDelete();
            }}
          >保存履歴を削除</button>
        </div>
      ) : (
        <div className={styles.historyForm}>
          <label>
            パスフレーズ（10文字以上）
            <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="off" />
          </label>
          {!hasSavedData && (
            <label>
              パスフレーズを再入力
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            </label>
          )}
          <button type="button" className={styles.secondaryButton} disabled={busy || !passphrase} onClick={() => void submit()}>
            {busy ? '処理中…' : hasSavedData ? '保存履歴を開く' : '暗号化保存を有効にする'}
          </button>
          {error && <p className={styles.fieldError} role="alert">{error}</p>}
        </div>
      )}
      {hasSavedData && !unlocked && (
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => {
            if (window.confirm('パスフレーズを入力せず、保存履歴を完全に削除しますか？')) void onDelete();
          }}
        >開かずに削除</button>
      )}
      <p className={styles.mutedText}>パスフレーズは保存されません。忘れた場合、履歴は復元できません。</p>
    </details>
  );
}

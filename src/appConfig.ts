export const appConfig = {
  appName: '生徒名かんたん割り当て',
  version: '0.1.1',
  privacyNotice:
    '入力した生徒名、割り当て条件、割り当て結果は外部へ送信されず、このページを開いているブラウザ内だけで処理されます。ページの表示には、静的サイトへアクセスするための通常の通信が発生しますが、入力内容はその通信に含まれません。',
  maxStudents: 100,
  maxRows: 10,
  maxColumns: 10,
  assignmentAttempts: 5000,
  undoLimit: 50,
  historyLimit: 2,
  autoLockMinutes: 15,
} as const;

export const dummyNames = Array.from(
  { length: 30 },
  (_, index) => `児童${String(index + 1).padStart(2, '0')}`,
);

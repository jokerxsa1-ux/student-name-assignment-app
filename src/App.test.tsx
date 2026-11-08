import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const storage = vi.hoisted(() => ({ saved: false }));
vi.mock('./infrastructure/historyStorage', () => ({
  loadEncryptedHistory: async () => (storage.saved ? { version: 1 } : undefined),
  saveEncryptedHistory: async () => {},
  deleteEncryptedHistory: async () => {},
  encryptHistory: async () => ({}),
  decryptHistory: async () => ({
    version: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    roster: [{ id: 'saved-1', name: '保存さん', excluded: false }],
    seatHistory: [],
  }),
}));

beforeEach(() => { storage.saved = false; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function setupWithDummy() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'ダミー30人' }));
  return user;
}
const goAssignment = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: '割り当てへ進む →' }));
const goRoster = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: '1. 名簿登録' }));

describe('アプリ全体', () => {
  it('固定した席を使用しないにすると、その固定が外れる', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('1行につき1人の名前'), 'Aさん{enter}Bさん{enter}Cさん');
    await user.click(screen.getByRole('button', { name: '名簿へ追加' }));
    await goAssignment(user);
    await user.selectOptions(screen.getAllByLabelText('固定席')[0], '1行 1列');
    await user.click(screen.getByRole('button', { name: '1-1' }));
    expect(screen.getAllByLabelText('固定席')[0]).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '自動割り当て' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('先頭に固定した生徒を除外すると、先頭固定が外れて順番を作れる', async () => {
    const user = await setupWithDummy();
    await goAssignment(user);
    await user.click(screen.getByRole('button', { name: /順番決め/ }));
    await user.selectOptions(screen.getByLabelText('先頭へ固定'), '児童01');
    await goRoster(user);
    await user.click(within(screen.getByLabelText('生徒一覧')).getAllByRole('checkbox')[0]);
    await goAssignment(user);
    await user.click(screen.getByRole('button', { name: /順番決め/ }));
    await user.click(screen.getByRole('button', { name: '自動割り当て' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(29);
  });

  it('名前を直しても座席表は残り、空欄の名前は元に戻る', async () => {
    const user = await setupWithDummy();
    await goAssignment(user);
    await user.click(screen.getByRole('button', { name: '自動割り当て' }));
    await goRoster(user);
    await user.type(screen.getByLabelText('児童01の名前'), 'X');
    await goAssignment(user);
    expect(screen.getByRole('button', { name: '印刷・PDF保存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /児童01X/ })).toBeInTheDocument();
    await goRoster(user);
    const input = screen.getByLabelText('児童01Xの名前');
    await user.clear(input);
    expect(input).toHaveValue('');
    await user.tab();
    expect(screen.getByLabelText('児童01Xの名前')).toHaveValue('児童01X');
  });

  it('保存した名簿を開くとき、今の名簿があれば確認し、キャンセルなら置き換えない', async () => {
    storage.saved = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('1行につき1人の名前'), '今の生徒');
    await user.click(screen.getByRole('button', { name: '名簿へ追加' }));
    await user.type(await screen.findByLabelText('パスフレーズ（10文字以上）'), 'passphrase-123');
    await user.click(screen.getByRole('button', { name: '保存した名簿を開く' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('今の生徒の名前')).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.type(screen.getByLabelText('パスフレーズ（10文字以上）'), 'passphrase-123');
    await user.click(screen.getByRole('button', { name: '保存した名簿を開く' }));
    expect(await screen.findByLabelText('保存さんの名前')).toBeInTheDocument();
  });
});

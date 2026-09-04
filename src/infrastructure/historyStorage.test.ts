import { describe, expect, it } from 'vitest';
import type { PersistedHistoryPayload } from '../domain/types';
import { decryptHistory, encryptHistory } from './historyStorage';

const payload: PersistedHistoryPayload = {
  version: 1,
  roster: [{ id: 's1', name: '児童01', excluded: false }],
  seatHistory: [{ id: 'h1', createdAt: new Date(0).toISOString(), placementByStudent: { s1: { row: 0, column: 0 } } }],
  savedAt: new Date(0).toISOString(),
};

describe('暗号化履歴', () => {
  it('正しいパスフレーズで復号できる', async () => {
    const record = await encryptHistory(payload, '十分に長いテスト用パスフレーズ', 1000);
    expect(record.ciphertext).not.toContain('児童01');
    await expect(decryptHistory(record, '十分に長いテスト用パスフレーズ')).resolves.toEqual(payload);
  });

  it('誤ったパスフレーズでは復号できない', async () => {
    const record = await encryptHistory(payload, '十分に長いテスト用パスフレーズ', 1000);
    await expect(decryptHistory(record, '間違っているパスフレーズです')).rejects.toThrow('パスフレーズが違う');
  });
});

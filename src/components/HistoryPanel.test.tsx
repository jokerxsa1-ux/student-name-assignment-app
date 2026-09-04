import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryPanel } from './HistoryPanel';

describe('端末内保存パネル', () => {
  const handlers = {
    onEnable: vi.fn(async () => undefined),
    onUnlock: vi.fn(async () => undefined),
    onLock: vi.fn(),
    onDelete: vi.fn(async () => undefined),
  };

  it('保存データがロック中は0件と断定しない', () => {
    render(
      <HistoryPanel
        hasSavedData
        unlocked={false}
        busy={false}
        historyCount={0}
        {...handlers}
      />,
    );
    expect(screen.getByText('保存データはロックされています。')).toBeInTheDocument();
    expect(screen.queryByText('席履歴は現在0件です。')).not.toBeInTheDocument();
  });

  it('未保存時は現在の履歴件数を表示する', () => {
    render(
      <HistoryPanel
        hasSavedData={false}
        unlocked={false}
        busy={false}
        historyCount={0}
        {...handlers}
      />,
    );
    expect(screen.getByText('席履歴は現在0件です。')).toBeInTheDocument();
  });
});

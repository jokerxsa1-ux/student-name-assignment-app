import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RosterPanel } from './RosterPanel';

describe('名簿パネル', () => {
  it('複数行の名前を読み込む', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RosterPanel students={[]} dummyDataLoaded={false} onChange={onChange} />);
    await user.type(screen.getByLabelText('1行につき1人の名前'), '児童01{enter}{enter} 児童02 ');
    await user.click(screen.getByRole('button', { name: '名簿へ追加' }));
    const [next] = onChange.mock.calls[0];
    expect(next.map((student: { name: string }) => student.name)).toEqual(['児童01', '児童02']);
  });
});

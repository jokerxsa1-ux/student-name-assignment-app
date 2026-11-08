import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

function Harness({ initial, onCommit }: { initial: number; onCommit: (value: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField label="列数" min={1} max={10} value={value} onCommit={(next) => { setValue(next); onCommit(next); }} />
      <button type="button" onClick={() => setValue(6)}>6にする</button>
    </>
  );
}

afterEach(cleanup);

describe('数値入力', () => {
  it('全部消してから新しい数字を入力できる', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={4} onCommit={onCommit} />);
    const input = screen.getByLabelText('列数');
    await user.clear(input);
    expect(input).toHaveValue(null);
    await user.type(input, '7');
    expect(input).toHaveValue(7);
    expect(onCommit).toHaveBeenLastCalledWith(7);
  });

  it('空欄のままフォーカスを外すと元の値に戻る', async () => {
    const user = userEvent.setup();
    render(<Harness initial={4} onCommit={vi.fn()} />);
    const input = screen.getByLabelText('列数');
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue(4);
  });

  it('範囲外の値はフォーカスを外すと補正される', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={4} onCommit={onCommit} />);
    const input = screen.getByLabelText('列数');
    await user.clear(input);
    await user.type(input, '25');
    await user.tab();
    expect(input).toHaveValue(10);
    expect(onCommit).toHaveBeenLastCalledWith(10);
  });

  it('外部で値が変わると表示も変わる', async () => {
    const user = userEvent.setup();
    render(<Harness initial={4} onCommit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '6にする' }));
    expect(screen.getByLabelText('列数')).toHaveValue(6);
  });
});

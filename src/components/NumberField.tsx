import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

/**
 * 数値入力。入力途中は空欄や範囲外の値をそのまま表示し、
 * 範囲内の整数になった時点で確定する。フォーカスを外したときに範囲へ補正する。
 */
export function NumberField({ label, value, min, max, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // 外部（ボタン・Undoなど）で値が変わったら表示を合わせる
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  const parse = (text: string) => (text.trim() === '' ? undefined : Number(text));

  const handleChange = (text: string) => {
    setDraft(text);
    const parsed = parse(text);
    if (parsed !== undefined && Number.isInteger(parsed) && parsed >= min && parsed <= max && parsed !== value) {
      setSyncedValue(parsed);
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parse(draft);
    if (parsed === undefined || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== value) {
      setSyncedValue(clamped);
      onCommit(clamped);
    }
  };

  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
      />
    </label>
  );
}

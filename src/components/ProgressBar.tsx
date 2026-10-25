export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

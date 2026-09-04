import type { AssignmentEvaluation } from '../domain/types';
import styles from '../styles/App.module.css';

export function ResultMessages({ evaluation }: { evaluation: AssignmentEvaluation }) {
  if (!evaluation.violations.length) return <div className={styles.conditionSuccess}>✓ すべての条件を満たしています</div>;
  return (
    <div className={styles.resultWarnings} role="status">
      <strong>確認が必要な条件</strong>
      <ul>{evaluation.violations.map((violation) => <li key={violation.id}>{violation.message}</li>)}</ul>
    </div>
  );
}

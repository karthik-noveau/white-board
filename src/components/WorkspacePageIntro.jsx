import { useId } from 'react';
import styles from '../styles/workspacePageIntro.module.css';

export function WorkspaceCreateButton({ children, ...props }) {
  return <button className={styles.createButton} {...props}>{children}</button>;
}

export default function WorkspacePageIntro({ title, titleId, description, eyebrow = 'Your workspace' }) {
  const generatedId = useId();
  const headingId = titleId || generatedId;
  return <header className={styles.intro} aria-labelledby={headingId} data-workspace-intro="">
    <div className={styles.copy}>
      <p className={styles.eyebrow}><span/>{eyebrow}</p>
      <h1 id={headingId}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  </header>;
}

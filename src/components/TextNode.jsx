import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import styles from './textNode.module.css';

const TextNode = ({ data }) => {
  return (
    <div
      className={styles.textNode}
      contentEditable
      suppressContentEditableWarning
      style={{ whiteSpace: 'pre-wrap' }}
    >
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      {data.label}
    </div>
  );
};

export default memo(TextNode);

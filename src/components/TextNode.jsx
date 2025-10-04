import React, { useState } from "react";
import styles from "../styles/textNode.module.css";

const TextNode = ({
  node,
  onAnchorClick,
  onDragStart,
  onTextChange,
  onToggleLock,
  NODE_WIDTH,
  NODE_HEIGHT,
  isOverview,
}) => {
  console.log("TextNode re-rendering", node.id);

  const handleMouseDown = (e) => {
    console.log("TextNode handleMouseDown", {
      nodeId: node.id,
      isOverview,
      isAnchor: e.target.dataset.anchor,
      isLocked: node.isLocked,
    });
    if (isOverview || e.target.dataset.anchor || node.isLocked) return; // Don't drag if in overview, clicking an anchor, or if locked
    onDragStart(e, node.id);
  };

  const anchorPositions = {
    top: { x: NODE_WIDTH / 2, y: 0 },
    right: { x: NODE_WIDTH, y: NODE_HEIGHT / 2 },
    bottom: { x: NODE_WIDTH / 2, y: NODE_HEIGHT },
    left: { x: 0, y: NODE_HEIGHT / 2 },
  };

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseDown={handleMouseDown}
      className={`${styles.nodeGroup} ${
        node.isLocked ? styles.nodeLocked : ""
      }`}
    >
      <rect
        x="0"
        y="0"
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        className={styles.nodeRect}
      />
      {!isOverview && (
        <text
          x={NODE_WIDTH / 2}
          y={NODE_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.nodeText}
        >
          {node.text}
        </text>
      )}

      {!isOverview &&
        Object.entries(anchorPositions).map(([anchorName, pos]) => (
          <circle
            key={anchorName}
            cx={pos.x}
            cy={pos.y}
            r="5"
            className={styles.anchor}
            data-anchor={anchorName} // Custom attribute to identify anchor clicks
            onClick={() => onAnchorClick(node.id, anchorName)}
          />
        ))}
    </g>
  );
};

export default TextNode;

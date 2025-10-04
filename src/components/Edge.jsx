import React from 'react';
import styles from '../styles/edge.module.css';

const Edge = ({ edge, nodes, isOverview }) => {
  console.log('Edge re-rendering', edge.id);
  const sourceNode = nodes.find((node) => node.id === edge.sourceId);
  const targetNode = nodes.find((node) => node.id === edge.targetId);

  if (!sourceNode || !targetNode) {
    return null; // Don't render if nodes are not found
  }

  // Define anchor points relative to node's top-left corner
  const NODE_WIDTH = 150; // Should be consistent with Canvas.jsx and TextNode.jsx
  const NODE_HEIGHT = 80; // Should be consistent with Canvas.jsx and TextNode.jsx

  const getAnchorPoint = (node, anchorPosition) => {
    switch (anchorPosition) {
      case 'top':
        return { x: node.x + NODE_WIDTH / 2, y: node.y };
      case 'right':
        return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
      case 'bottom':
        return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT };
      case 'left':
        return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
      default:
        return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 }; // Center as fallback
    }
  };

  const sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor);
  const targetPoint = { x: targetNode.x + NODE_WIDTH / 2, y: targetNode.y + NODE_HEIGHT / 2 }; // Target to center of node

  const offset = 40; // How far the line extends before making a turn

  let pathData = `M ${sourcePoint.x} ${sourcePoint.y}`;

  // Determine the intermediate points for the elbow connector
  let p1x = sourcePoint.x;
  let p1y = sourcePoint.y;
  let p2x = targetPoint.x;
  let p2y = targetPoint.y;

  switch (edge.sourceAnchor) {
    case 'top':
      p1y = sourcePoint.y - offset;
      p2x = targetPoint.x;
      p2y = sourcePoint.y - offset;
      break;
    case 'right':
      p1x = sourcePoint.x + offset;
      p2x = sourcePoint.x + offset;
      p2y = targetPoint.y;
      break;
    case 'bottom':
      p1y = sourcePoint.y + offset;
      p2x = targetPoint.x;
      p2y = sourcePoint.y + offset;
      break;
    case 'left':
      p1x = sourcePoint.x - offset;
      p2x = sourcePoint.x - offset;
      p2y = targetPoint.y;
      break;
    default:
      // Fallback to straight line if anchor is unknown
      pathData += ` L ${targetPoint.x} ${targetPoint.y}`;
      break;
  }

  // Add intermediate points if not a fallback
  if (edge.sourceAnchor) {
    pathData += ` L ${p1x} ${p1y}`;
    pathData += ` L ${p2x} ${p2y}`;
    pathData += ` L ${targetPoint.x} ${targetPoint.y}`;
  }

  return (
    <path
      d={pathData}
      className={styles.edgeLine}
      fill="none"
      strokeWidth={isOverview ? 0.5 : 2} // Thinner lines in overview
      markerEnd={isOverview ? "" : "url(#arrowhead)"} // No arrowheads in overview
    />
  );
};

export default Edge;

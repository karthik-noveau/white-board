import React, { useState, useCallback } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import TextNode from './TextNode';
import CustomEdge from './Edge';
import styles from './canvas.module.css';

const initialNodes = [];
const initialEdges = [];

const nodeTypes = { textNode: TextNode };
const edgeTypes = { 'custom-edge': CustomEdge };

let nodeId = 0;
const createNodeId = () => `node_${nodeId++}`;

function Canvas() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onPaneClick = useCallback(
    (event) => {
      if (nodes.length === 0) {
        const newNode = {
          id: createNodeId(),
          type: 'textNode',
          position: {
            x: event.clientX - 75,
            y: event.clientY - 20,
          },
          data: { label: 'Text Node 1' },
        };
        setNodes([newNode]);
      }
    },
    [nodes]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      const newNodeId = createNodeId();
      const newNode = {
        id: newNodeId,
        type: 'textNode',
        position: {
          x: node.position.x + node.width + 100,
          y: node.position.y,
        },
        data: { label: `Text Node ${nodeId}` },
      };

      const newEdge = {
        id: `e${node.id}-${newNodeId}`,
        source: node.id,
        target: newNodeId,
        type: 'custom-edge',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) => eds.concat(newEdge));
    },
    [setNodes, setEdges]
  );

  return (
    <div className={styles.canvasWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      />
    </div>
  );
}

export default Canvas;

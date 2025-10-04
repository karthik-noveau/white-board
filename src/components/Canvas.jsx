import React, { useState, useCallback, useEffect, useMemo } from "react";
import TextNode from "./TextNode";
import Edge from "./Edge";
import styles from "../styles/canvas.module.css";

const NODE_WIDTH = 150;
const NODE_HEIGHT = 80;
const SPACING = 50; // Spacing between nodes

function Canvas() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nextNodeId, setNextNodeId] = useState(1);
  const [nextEdgeId, setNextEdgeId] = useState(1);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const [viewportDragStart, setViewportDragStart] = useState({ x: 0, y: 0 });

  const toggleCanvasLock = useCallback(() => {
    setIsCanvasLocked((prev) => !prev);
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const handleZoom = useCallback(
    (zoomFactor) => {
      const scaleAmount = 1.1; // Zoom factor
      const newScale = transform.scale * zoomFactor;

      // Limit zoom level
      if (newScale < 0.1 || newScale > 5) return;

      // Zoom towards the center of the screen
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      setTransform((prev) => ({
        scale: newScale,
        x: centerX - (centerX - prev.x) / (prev.scale / newScale),
        y: centerY - (centerY - prev.y) / (prev.scale / newScale),
      }));
    },
    [transform]
  );

  const handleWheel = useCallback(
    (e) => {
      if (isCanvasLocked) return; // Prevent zoom if canvas is locked
      e.preventDefault();
      const scaleAmount = 1.1; // Zoom factor
      const newScale =
        e.deltaY < 0
          ? transform.scale * scaleAmount
          : transform.scale / scaleAmount;

      // Limit zoom level
      if (newScale < 0.1 || newScale > 5) return;

      // Calculate mouse position in SVG coordinates
      const svg = e.currentTarget;
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      const transformedPoint = svgPoint.matrixTransform(
        svg.getScreenCTM().inverse()
      );

      setTransform((prev) => ({
        scale: newScale,
        x:
          transformedPoint.x -
          (transformedPoint.x - prev.x) / (prev.scale / newScale),
        y:
          transformedPoint.y -
          (transformedPoint.y - prev.y) / (prev.scale / newScale),
      }));
    },
    [transform]
  );

  const addNode = useCallback(() => {
    if (isCanvasLocked) return; // Prevent node creation if canvas is locked
    // Calculate center of the current view in world coordinates
    const centerX = (window.innerWidth / 2 - transform.x) / transform.scale;
    const centerY = (window.innerHeight / 2 - transform.y) / transform.scale;

    const newNode = {
      id: `node-${nextNodeId}`,
      text: `Node ${nextNodeId}`,
      x: centerX - NODE_WIDTH / 2,
      y: centerY - NODE_HEIGHT / 2,
      anchorUsage: { top: 0, right: 0, bottom: 0, left: 0 },
      isLocked: false,
    };
    setNodes((prevNodes) => [...prevNodes, newNode]);
    setNextNodeId((prevId) => prevId + 1);
  }, [nextNodeId, transform, isCanvasLocked]);

  const handleAnchorClick = useCallback(
    (sourceNodeId, anchorPosition) => {
      if (isCanvasLocked) return; // Prevent anchor click if canvas is locked
      setNodes((prevNodes) => {
        const sourceNodeIndex = prevNodes.findIndex(
          (node) => node.id === sourceNodeId
        );
        if (sourceNodeIndex === -1) return prevNodes;

        const sourceNode = { ...prevNodes[sourceNodeIndex] };
        const currentAnchorCount = sourceNode.anchorUsage[anchorPosition];

        // Calculate new node position based on anchor and count
        let newX = sourceNode.x;
        let newY = sourceNode.y;

        // Offset for alternating pattern
        const offsetMultiplier = Math.ceil((currentAnchorCount + 1) / 2);
        const alternatingSign = currentAnchorCount % 2 === 0 ? 1 : -1; // 0, 2, 4... -> 1; 1, 3, 5... -> -1

        switch (anchorPosition) {
          case "top":
            newY = sourceNode.y - NODE_HEIGHT - SPACING;
            if (currentAnchorCount > 0) {
              newX +=
                alternatingSign * offsetMultiplier * (NODE_WIDTH + SPACING);
            }
            break;
          case "right":
            newX = sourceNode.x + NODE_WIDTH + SPACING;
            if (currentAnchorCount > 0) {
              newY +=
                alternatingSign * offsetMultiplier * (NODE_HEIGHT + SPACING);
            }
            break;
          case "bottom":
            newY = sourceNode.y + NODE_HEIGHT + SPACING;
            if (currentAnchorCount > 0) {
              newX +=
                alternatingSign * offsetMultiplier * (NODE_WIDTH + SPACING);
            }
            break;
          case "left":
            newX = sourceNode.x - NODE_WIDTH - SPACING;
            if (currentAnchorCount > 0) {
              newY +=
                alternatingSign * offsetMultiplier * (NODE_HEIGHT + SPACING);
            }
            break;
          default:
            break;
        }

        // Update anchor usage for the source node
        sourceNode.anchorUsage = {
          ...sourceNode.anchorUsage,
          [anchorPosition]: currentAnchorCount + 1,
        };

        const newNodeId = `node-${nextNodeId}`;
        const newEdgeId = `edge-${nextEdgeId}`;

        const newNode = {
          id: newNodeId,
          text: `Node ${nextNodeId}`,
          x: newX,
          y: newY,
          anchorUsage: { top: 0, right: 0, bottom: 0, left: 0 },
          isLocked: false, // Added isLocked: false here
        };

        const newEdge = {
          id: newEdgeId,
          sourceId: sourceNodeId,
          sourceAnchor: anchorPosition,
          targetId: newNodeId,
        };

        setNextNodeId((prevId) => prevId + 1);
        setNextEdgeId((prevId) => prevId + 1);
        setEdges((prevEdges) => [...prevEdges, newEdge]);

        const updatedNodes = [...prevNodes];
        updatedNodes[sourceNodeIndex] = sourceNode;
        return [...updatedNodes, newNode];
      });
    },
    [nextNodeId, nextEdgeId, isCanvasLocked]
  );

  const handleNodeTextChange = useCallback((nodeId, newText) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, text: newText } : node
      )
    );
  }, []);

  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleCanvasMouseDown = useCallback(
    (e) => {
      if (isCanvasLocked) return; // Prevent pan if canvas is locked
      // Only pan if not clicking on a node or anchor
      if (
        e.target.tagName === "svg" ||
        e.target.classList.contains(styles.svgCanvas)
      ) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      }
    },
    [transform, isCanvasLocked]
  );

  const handleNodeDragStart = useCallback(
    (e, nodeId) => {
      console.log("handleNodeDragStart", {
        nodeId,
        isCanvasLocked,
        isNodeLocked: nodes.find((n) => n.id === nodeId)?.isLocked,
      });
      if (isCanvasLocked) return; // Prevent drag if canvas is locked
      const node = nodes.find((n) => n.id === nodeId);
      if (node && !node.isLocked) {
        // Prevent drag if locked
        // Convert screen coordinates to world coordinates for drag offset
        const worldMouseX = (e.clientX - transform.x) / transform.scale;
        const worldMouseY = (e.clientY - transform.y) / transform.scale;
        setDraggingNodeId(nodeId);
        setDragOffset({ x: worldMouseX - node.x, y: worldMouseY - node.y });
      }
    },
    [nodes, transform, isCanvasLocked]
  );

  const handleCanvasMouseMove = useCallback(
    (e) => {
      console.log("handleCanvasMouseMove", {
        draggingNodeId,
        isPanning,
        isCanvasLocked,
      });
      if (isCanvasLocked) return; // Prevent move if canvas is locked
      if (isPanning) {
        setTransform((prev) => ({
          ...prev,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
      } else if (draggingNodeId) {
        requestAnimationFrame(() => {
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (node.id === draggingNodeId) {
                // Convert screen coordinates to world coordinates for new position
                const worldMouseX = (e.clientX - transform.x) / transform.scale;
                const worldMouseY = (e.clientY - transform.y) / transform.scale;
                return {
                  ...node,
                  x: worldMouseX - dragOffset.x,
                  y: worldMouseY - dragOffset.y,
                };
              }
              return node;
            })
          );
        });
      }
    },
    [isPanning, panStart, draggingNodeId, dragOffset, transform, isCanvasLocked]
  );

  const handleCanvasMouseUp = useCallback(() => {
    console.log("handleCanvasMouseUp", { draggingNodeId });
    setIsPanning(false);
    setDraggingNodeId(null);
  }, []);

  // Calculate bounding box of all nodes for overview map
  const getNodesBoundingBox = () => {
    console.log('getNodesBoundingBox called', { nodesLength: nodes.length });
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 }; // Default small box
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT);
    });

    console.log('nodesBoundingBox result', { minX, minY, maxX, maxY });
    return { minX, minY, maxX, maxY };
  };

  const nodesBoundingBox = getNodesBoundingBox();
  console.log('nodesBoundingBox', nodesBoundingBox);
  const overviewMapWidth = 200;
  const overviewMapHeight = 150;

  const contentWidth = nodesBoundingBox.maxX - nodesBoundingBox.minX;
  const contentHeight = nodesBoundingBox.maxY - nodesBoundingBox.minY;

  console.log('contentWidth', contentWidth, 'contentHeight', contentHeight);
  const overviewScale = Math.min(
    overviewMapWidth / (contentWidth === 0 ? 1 : contentWidth),
    overviewMapHeight / (contentHeight === 0 ? 1 : contentHeight)
  );
  console.log('overviewScale', overviewScale);

  const overviewTranslateX = -nodesBoundingBox.minX * overviewScale + (overviewMapWidth - contentWidth * overviewScale) / 2;
  const overviewTranslateY = -nodesBoundingBox.minY * overviewScale + (overviewMapHeight - contentHeight * overviewScale) / 2;

  const handleViewportMouseDown = useCallback(
    (e) => {
      e.stopPropagation(); // Prevent panning the main canvas
      setIsDraggingViewport(true);
      setViewportDragStart({
        x: e.clientX - (-transform.x / transform.scale) * overviewScale,
        y: e.clientY - (-transform.y / transform.scale) * overviewScale,
      });
    },
    [transform, overviewScale]
  );

  const handleOverviewMouseMove = useCallback(
    (e) => {
      if (isDraggingViewport) {
        const newX = (e.clientX - viewportDragStart.x) / overviewScale;
        const newY = (e.clientY - viewportDragStart.y) / overviewScale;

        setTransform((prev) => ({
          ...prev,
          x: -newX * prev.scale,
          y: -newY * prev.scale,
        }));
      }
    },
    [isDraggingViewport, viewportDragStart, overviewScale]
  );

  const handleOverviewMouseUp = useCallback(() => {
    setIsDraggingViewport(false);
  }, []);

  const handleToggleLock = useCallback((nodeId) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, isLocked: !node.isLocked } : node
      )
    );
  }, []);

  // Keyboard actions
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isCanvasLocked) return;

      const panAmount = 20; // Pixels to pan

      switch (e.key) {
        case "+":
        case "=":
          handleZoom(1.1);
          break;
        case "-":
          handleZoom(1 / 1.1);
          break;
        case "w":
        case "W":
          setTransform((prev) => ({ ...prev, y: prev.y + panAmount }));
          break;
        case "s":
        case "S":
          setTransform((prev) => ({ ...prev, y: prev.y - panAmount }));
          break;
        case "a":
        case "A":
          setTransform((prev) => ({ ...prev, x: prev.x + panAmount }));
          break;
        case "d":
        case "D":
          setTransform((prev) => ({ ...prev, x: prev.x - panAmount }));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleZoom, isCanvasLocked]);

  return (
    <div className={styles.canvasContainer}>
      <button onClick={addNode} className={styles.createNodeButton}>
        Create Node
      </button>
      <button onClick={toggleCanvasLock} className={styles.lockCanvasButton}>
        {isCanvasLocked ? "Unlock Canvas" : "Lock Canvas"}
      </button>
      <button
        onClick={handleFullscreenToggle}
        className={styles.fullscreenButton}
      >
        Fullscreen
      </button>
      <button onClick={() => handleZoom(1.1)} className={styles.zoomInButton}>
        +
      </button>
      <button
        onClick={() => handleZoom(1 / 1.1)}
        className={styles.zoomOutButton}
      >
        -
      </button>
      <svg
        className={styles.svgCanvas}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <defs>
          <pattern
            id="dotPattern"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#cccccc" />
          </pattern>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#666666" />
          </marker>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#dotPattern)" />
        {edges.map((edge) => (
          <Edge key={edge.id} edge={edge} nodes={nodes} />
        ))}
        {nodes.map((node) => (
          <TextNode
            key={node.id}
            node={node}
            onAnchorClick={handleAnchorClick}
            onDragStart={handleNodeDragStart}
            onTextChange={handleNodeTextChange}
            onToggleLock={handleToggleLock} // Pass the new handler
            NODE_WIDTH={NODE_WIDTH}
            NODE_HEIGHT={NODE_HEIGHT}
          />
        ))}
      </svg>

      {/* Overview Mini-map */}
      <svg
        className={styles.overviewMap}
        onMouseMove={handleOverviewMouseMove}
        onMouseUp={handleOverviewMouseUp}
      >
        <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0" stroke="#ccc" strokeWidth="1" />
        <g transform={`translate(${overviewTranslateX}, ${overviewTranslateY}) scale(${overviewScale})`}>
          {edges.map((edge) => (
            <Edge key={edge.id} edge={edge} nodes={nodes} isOverview={true} />
          ))}
          {nodes.map((node) => (
            <TextNode
              key={node.id}
              node={node}
              // No interactivity in overview
              NODE_WIDTH={NODE_WIDTH}
              NODE_HEIGHT={NODE_HEIGHT}
              isOverview={true}
            />
          ))}
        </g>
        {/* Viewport Rectangle */}
        <rect
          x={(-transform.x + nodesBoundingBox.minX * overviewScale) / overviewScale}
          y={(-transform.y + nodesBoundingBox.minY * overviewScale) / overviewScale}
          width={window.innerWidth / transform.scale}
          height={window.innerHeight / transform.scale}
          fill="rgba(0, 123, 255, 0.2)"
          stroke="#007bff"
          strokeWidth="2"
          onMouseDown={handleViewportMouseDown}
          style={{ cursor: 'grab' }}
        />
      </svg>
    </div>
  );
}

export default Canvas;

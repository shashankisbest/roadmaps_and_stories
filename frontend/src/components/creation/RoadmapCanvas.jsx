import { useCallback } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function RoadmapNode({ id, data, selected }) {
  const title = data.title || data.label || "Roadmap step";
  const description = data.description || "";
  if (data.readOnly) {
    return (
      <article className={`roadmap-canvas-node${selected ? " selected" : ""}`}>
        <Handle type="target" position={Position.Left} aria-label="Previous roadmap step" />
        <span className="roadmap-node-label">ROADMAP STEP</span>
        <h3 className="roadmap-node-title-readonly">{title}</h3>
        {description && <p className="roadmap-node-description-readonly">{description}</p>}
        <Handle type="source" position={Position.Right} aria-label="Next roadmap step" />
      </article>
    );
  }

  return (
    <article className={`roadmap-canvas-node${selected ? " selected" : ""}`}>
      <Handle type="target" position={Position.Left} aria-label="Connect from previous step" />
      <span className="roadmap-node-label">ROADMAP STEP</span>
      <input
        className="roadmap-node-title"
        value={title}
        aria-label="Roadmap step title"
        onChange={(event) => data.onChange(id, "title", event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <textarea
        className="roadmap-node-description"
        value={description}
        aria-label="Roadmap step description"
        placeholder="Add a little context..."
        rows={3}
        onChange={(event) => data.onChange(id, "description", event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <Handle type="source" position={Position.Right} aria-label="Connect to next step" />
    </article>
  );
}

const nodeTypes = { roadmapStep: RoadmapNode };
const noop = () => {};
let fallbackNodeId = 0;

function createNodeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  fallbackNodeId += 1;
  return `roadmap-step-${Date.now()}-${fallbackNodeId}`;
}

function CanvasActions({ onAddNode, readOnly }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="roadmap-canvas-actions" role="toolbar" aria-label="Roadmap canvas controls">
      {!readOnly && (
        <>
          <button type="button" onClick={onAddNode}>+ Add step</button>
          <span className="canvas-action-divider" />
        </>
      )}
      <button type="button" aria-label="Zoom out" onClick={() => zoomOut()}>−</button>
      <button type="button" aria-label="Zoom in" onClick={() => zoomIn()}>+</button>
      <button type="button" onClick={() => fitView({ padding: 0.25 })}>Fit view</button>
    </div>
  );
}

export default function RoadmapCanvas({
  nodes,
  edges,
  setNodes = noop,
  setEdges = noop,
  readOnly = false,
}) {
  const updateNode = useCallback((nodeId, key, value) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => (
        node.id === nodeId
          ? { ...node, data: { ...node.data, [key]: value } }
          : node
      )),
    );
  }, [setNodes]);

  const handleNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, [setNodes]);

  const handleEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, [setEdges]);

  const handleConnect = useCallback((connection) => {
    setEdges((currentEdges) => addEdge(connection, currentEdges));
  }, [setEdges]);

  const addNode = useCallback(() => {
    const nodeNumber = nodes.length + 1;
    const id = createNodeId();
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: "roadmapStep",
        position: { x: 80 + ((nodeNumber - 1) % 3) * 300, y: 100 + Math.floor((nodeNumber - 1) / 3) * 220 },
        data: {
          title: `Step ${nodeNumber}`,
          description: "",
          onChange: updateNode,
        },
      },
    ]);
  }, [nodes.length, setNodes, updateNode]);

  const flowNodes = nodes.map((node) => ({
    ...node,
    type: "roadmapStep",
    data: {
      ...node.data,
      ...(readOnly ? { readOnly: true } : { onChange: updateNode }),
    },
  }));

  return (
    <div className="roadmap-canvas-frame">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#343a55" gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#8c91ff"
          maskColor="rgba(12, 15, 28, 0.68)"
        />
        <Controls showInteractive={false} />
        <CanvasActions onAddNode={addNode} readOnly={readOnly} />
      </ReactFlow>
      {!readOnly && nodes.length === 0 && (
        <div className="roadmap-canvas-empty" aria-live="polite">
          <span>YOUR ROADMAP STARTS HERE</span>
          <h3>Make the first move</h3>
          <p>Add a step, then connect it to show how your plans unfold.</p>
          <button type="button" onClick={addNode}>+ Add your first step</button>
        </div>
      )}
    </div>
  );
}

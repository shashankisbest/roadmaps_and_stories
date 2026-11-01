const PREVIEW_WIDTH = 1440;
const PREVIEW_HEIGHT = 900;
const NODE_WIDTH = 250;
const NODE_HEIGHT = 136;
const NODE_GAP = 55;
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;

function getPosition(node, index) {
  const position = node.position || {};
  return {
    x: Number.isFinite(position.x) ? position.x : (index % 3) * (NODE_WIDTH + NODE_GAP),
    y: Number.isFinite(position.y) ? position.y : Math.floor(index / 3) * (NODE_HEIGHT + NODE_GAP),
  };
}

function wrapText(context, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const result = lines.slice(0, maxLines);
    let last = result[maxLines - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    result[maxLines - 1] = `${last}…`;
    return result;
  }
  return lines;
}

export function generateRoadmapPreview(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return Promise.resolve(null);

  const positions = new Map(
    nodes.map((node, index) => [node.id, getPosition(node, index)]),
  );
  const nodeBounds = nodes.map((node, index) => ({
    node,
    position: getPosition(node, index),
  }));
  const minX = Math.min(...nodeBounds.map(({ position }) => position.x));
  const minY = Math.min(...nodeBounds.map(({ position }) => position.y));
  const maxX = Math.max(...nodeBounds.map(({ position }) => position.x + NODE_WIDTH));
  const maxY = Math.max(...nodeBounds.map(({ position }) => position.y + NODE_HEIGHT));
  const padding = 54;
  const scale = Math.min(
    1,
    (PREVIEW_WIDTH - padding * 2) / Math.max(1, maxX - minX),
    (PREVIEW_HEIGHT - padding * 2) / Math.max(1, maxY - minY),
  );
  const width = Math.max(320, Math.min(PREVIEW_WIDTH, Math.ceil((maxX - minX) * scale + padding * 2)));
  const height = Math.max(220, Math.min(PREVIEW_HEIGHT, Math.ceil((maxY - minY) * scale + padding * 2)));
  const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Could not create a roadmap preview."));

  context.fillStyle = "#111424";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(122, 130, 170, 0.12)";
  context.lineWidth = 1;
  const gridGap = Math.max(14, Math.round(24 * scale));
  for (let x = 0; x < width; x += gridGap) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += gridGap) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  for (const edge of edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    const x1 = source.x + NODE_WIDTH;
    const y1 = source.y + NODE_HEIGHT / 2;
    const x2 = target.x;
    const y2 = target.y + NODE_HEIGHT / 2;
    const curve = Math.max(42, Math.abs(x2 - x1) * 0.45);
    context.beginPath();
    context.moveTo(x1, y1);
    context.bezierCurveTo(x1 + curve, y1, x2 - curve, y2, x2, y2);
    context.strokeStyle = "#777de0";
    context.lineWidth = 2;
    context.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    context.beginPath();
    context.moveTo(x2, y2);
    context.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
    context.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fillStyle = "#999eff";
    context.fill();

    if (edge.label) {
      context.font = "12px Inter, sans-serif";
      context.fillStyle = "#c5c8d6";
      context.textAlign = "center";
      context.fillText(String(edge.label), (x1 + x2) / 2, (y1 + y2) / 2 - 8, Math.max(24, Math.abs(x2 - x1)));
    }
  }

  for (const { node, position } of nodeBounds) {
    const x = position.x;
    const y = position.y;
    context.shadowColor = "rgba(0, 0, 0, 0.28)";
    context.shadowBlur = 18;
    context.fillStyle = "#181c31";
    context.strokeStyle = "#555d88";
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(x, y, NODE_WIDTH, NODE_HEIGHT, 13);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    context.fillStyle = "#999eff";
    context.font = "700 10px Inter, sans-serif";
    context.textAlign = "left";
    context.fillText("ROADMAP STEP", x + 18, y + 25);

    context.fillStyle = "#f0f1f7";
    context.font = "700 17px Inter, sans-serif";
    const titleLines = wrapText(
      context,
      node.data?.title || node.data?.label || "Roadmap step",
      NODE_WIDTH - 36,
      2,
    );
    titleLines.forEach((line, index) => {
      context.fillText(line, x + 18, y + 55 + index * 21);
    });

    context.fillStyle = "#a6abc1";
    context.font = "12px Inter, sans-serif";
    const descriptionLines = wrapText(
      context,
      node.data?.description,
      NODE_WIDTH - 36,
      2,
    );
    descriptionLines.forEach((line, index) => {
      context.fillText(line, x + 18, y + 94 + index * 17);
    });
  }
  context.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode the roadmap preview."));
        return;
      }
      if (blob.size > MAX_PREVIEW_BYTES) {
        reject(new Error("The roadmap preview is too large to store."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the roadmap preview."));
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

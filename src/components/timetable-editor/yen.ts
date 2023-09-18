// import { getShortestPathFromN } from './dijkstra';
// Yen's algorithm たぶん動いていない

type Node = {
  id: string;
  name: string;
};

type Edge = {
  source: string;
  target: string;
  id: string;
  value: number;
};

type Graph = {
  nodes: Node[];
  edges: Edge[];
};

function getShortestPathFromN(graph: Graph, source: string, sink: string): Edge[] {
  const visitedNodes: string[] = [];
  const unvisitedNodes: string[] = graph.nodes.map((node) => node.id);
  const distances: { [key: string]: number } = {};
  const previous: { [key: string]: string } = {};

  for (const node of graph.nodes) {
    distances[node.id] = Infinity;
  }

  distances[source] = 0;

  while (unvisitedNodes.length > 0) {
    const currentNode = unvisitedNodes.reduce((a, b) => (distances[a] < distances[b] ? a : b));
    unvisitedNodes.splice(unvisitedNodes.indexOf(currentNode), 1);
    visitedNodes.push(currentNode);

    for (const edge of graph.edges.filter((edge) => edge.source === currentNode)) {
      const neighbourNode = edge.target;
      if (!visitedNodes.includes(neighbourNode)) {
        const newDistance = distances[currentNode] + edge.value;
        if (newDistance < distances[neighbourNode]) {
          distances[neighbourNode] = newDistance;
          previous[neighbourNode] = currentNode;
        }
      }
    }
  }

  const path: Edge[] = [];
  let currentNode = sink;
  while (currentNode !== source) {
    const previousNode = previous[currentNode];
    const edge = graph.edges.find((edge) => edge.source === previousNode && edge.target === currentNode);
    if (edge) {
      path.unshift(edge);
    }
    currentNode = previousNode;
  }

  return path;
}

function isPathEqual(path1: Edge[], path2: Edge[]): boolean {
  if (path1.length !== path2.length) {
    return false;
  }

  for (let i = 0; i < path1.length; i++) {
    if (path1[i].id !== path2[i].id) {
      return false;
    }
  }

  return true;
}

function getPathLength(path: Edge[]): number {
  let length = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const edge = path[i];
    length += edge.value;
  }

  return length;
}

export function getKShortestPathFromNUsingYensAlgorithm(graph: Graph, source: Node, sink: Node, K: number) {
  const A: Edge[][] = [getShortestPathFromN(graph, source.id, sink.id)];
  const B: Edge[][] = [];

  for (let k = 1; k < K; k++) {
    for (let i = 0; i < A[k - 1].length - 1; i++) {
      const spurNode = A[k - 1][i].source;
      const rootPath = A[k - 1].slice(0, i + 1);

      const removedEdges = [...graph.edges];
      for (const path of A) {
        if (isPathEqual(rootPath, path.slice(0, i + 1))) {
          const edgeToRemove: Edge = path[i + 1];
          removedEdges.splice(
            removedEdges.findIndex((edge) => edge.id === edgeToRemove.id),
            1
          );
        }
      }

      const removedNodes = graph.nodes.filter((node) => rootPath.some((pathNode) => pathNode.source === node.id));
      const graphWithEdgesRemoved = {
        nodes: removedNodes,
        edges: removedEdges,
      };

      const spurPath = getShortestPathFromN(graphWithEdgesRemoved, spurNode, sink.id);

      if (spurPath.length > 0) {
        const totalPath = rootPath.concat(spurPath);
        if (!B.some((path) => isPathEqual(path, totalPath))) {
          B.push(totalPath);
        }
      }
    }

    if (B.length === 0) {
      break;
    }

    B.sort((a, b) => {
      return getPathLength(a) - getPathLength(b);
    });

    A.push(B[0]);
    B.splice(0, 1);
  }

  return A;
}

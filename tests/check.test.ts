import { test, expect } from 'vitest'
import { abstractSearch } from "../src/trackUtil.js";
import { moduloRoundUp } from '../src/common.js';

class Graph<T> {
  nodes: T[] = [];
  edges: [T, T, number][] = [];

  addNode(node: T) {
    this.nodes.push(node);
  }

  addDirectedEdge(node1: T, node2: T, distance: number) {
    this.edges.push([
      this.nodes.filter(n => n === node1)[0],
      this.nodes.filter(n => n === node2)[0],
      distance
    ]);
  }

  getNextNode(node: T): T[] {
    return this.edges.filter(([n1]) => n1 === node).map(([_, n2]) => n2);
  }

  getDistance(node1: T, node2: T): number {
    return this.edges.filter(([n1, n2]) => n1 === node1 && n2 === node2).map(([_, __, d]) => d)[0];
  }
}

test("abstractSearch", () => {
  let g = new Graph<string>();
  g.addNode("A");
  g.addNode("B");
  g.addNode("C");
  g.addNode("D");
  g.addNode("E");
  g.addNode("F");
  g.addNode("G");
  
  g.addDirectedEdge("A", "C", 100);
  g.addDirectedEdge("A", "B", 3);
  g.addDirectedEdge("A", "D", 4);
  g.addDirectedEdge("D", "C", 3);
  g.addDirectedEdge("D", "E", 8);
  g.addDirectedEdge("E", "F", 10);
  g.addDirectedEdge("B", "G", 9);
  g.addDirectedEdge("E", "G", 50);
  
  const result = abstractSearch(
    "A",
    c => c.charCodeAt(0),
    c => g.getNextNode(c),
    (c1, c2) => g.getDistance(c1, c2),
    c => false
  );

  expect(result[0]).toBe(undefined);
  expect(
    Array.from(result[1].entries())
    .map(e => ({ node: e[1].node, distance: e[1].distance }))
    .sort((a, b) => a.node.charCodeAt(0) - b.node.charCodeAt(0))
    .map(e => e.node + ': ' + e.distance)
    .join(', ')
  )
  .toBe('A: 0, B: 3, C: 7, D: 4, E: 12, F: 22, G: 12');
});

test('moduloRoundDown', () => {
  expect(moduloRoundDown(15, 10)).toBe(10);
  expect(moduloRoundDown(10, 10)).toBe(10);
})
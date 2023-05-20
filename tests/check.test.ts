import { test, expect } from 'vitest'
import { abstractSearch } from "../src/trackUtil.js";

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

test("check1", () => {
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

// function createSwitch(): Switch {
//   return {
//     switchId: generateId(),
//     switchPatterns: []
//   } as unknown as Switch;
// }

// function createTrack(distance: number, _nextSwitch: Switch): HalfTrack {
//   return {
//     trackId: generateId(),
//     _begin: { x: 0, y: 0 },
//     _end: { x: distance, y: 0 },
//     _nextSwitch: _nextSwitch,
//     track: { station: null },
//   } as HalfTrack;
// }

// function sp(track1: HalfTrack, tracks: HalfTrack[]): [HalfTrack, HalfTrack][] {
//   return tracks.map(track => [track1, track])
// }

// 辺の追加が面倒すぎてあきらめた
// test("check", () => {
//   const switches = [
//     createSwitch(), // A: 0
//     createSwitch(), // B: 1
//     createSwitch(), // C: 2
//     createSwitch(), // D: 3
//     createSwitch(), // E: 4
//     createSwitch(), // F: 5
//     createSwitch(), // G: 6
//   ];
//   const tracks: HalfTrack[] = [
//     createTrack(0, switches[0]),  // 0: to A
//     createTrack(100, switches[2]),// 1
//     createTrack(3, switches[1]),  // 2
//     createTrack(4, switches[3]),  // 3
//     createTrack(3, switches[2]),  // 4
//     createTrack(8, switches[4]),  // 5
//     createTrack(10, switches[5]), // 6
//     createTrack(9, switches[6]),  // 7
//     createTrack(50, switches[6]), // 8
//   ];
//   switches[0].switchPatterns = sp(tracks[0], [tracks[1], tracks[2], tracks[3]]);
//   switches[1].switchPatterns = sp(tracks[2], [tracks[7]]);
//   switches[2].switchPatterns = [];
//   switches[3].switchPatterns = sp(tracks[3], [tracks[4], tracks[5]]);
//   switches[4].switchPatterns = sp(tracks[5], [tracks[6], tracks[8]]);
//   switches[5].switchPatterns = [];
//   switches[6].switchPatterns = [];

//   const r = searchTrack(tracks[0], -1);
//   console.dir(r, { depth: 4 });
//   console.log("OK");
// });

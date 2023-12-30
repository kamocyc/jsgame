import { expect, test } from 'vitest';
import { parseTime, sum, toStringFromSeconds, upto } from '../src/common.js';
import { abstractSearch } from '../src/trackUtil.js';

class Graph<T> {
  nodes: T[] = [];
  edges: [T, T, number][] = [];

  addNode(node: T) {
    this.nodes.push(node);
  }

  addDirectedEdge(node1: T, node2: T, distance: number) {
    this.edges.push([this.nodes.filter((n) => n === node1)[0], this.nodes.filter((n) => n === node2)[0], distance]);
  }

  getNextNode(node: T): T[] {
    return this.edges.filter(([n1]) => n1 === node).map(([_, n2]) => n2);
  }

  getDistance(node1: T, node2: T): number {
    return this.edges.filter(([n1, n2]) => n1 === node1 && n2 === node2).map(([_, __, d]) => d)[0];
  }
}

test('abstractSearch', () => {
  let g = new Graph<string>();
  g.addNode('A');
  g.addNode('B');
  g.addNode('C');
  g.addNode('D');
  g.addNode('E');
  g.addNode('F');
  g.addNode('G');

  g.addDirectedEdge('A', 'C', 100);
  g.addDirectedEdge('A', 'B', 3);
  g.addDirectedEdge('A', 'D', 4);
  g.addDirectedEdge('D', 'C', 3);
  g.addDirectedEdge('D', 'E', 8);
  g.addDirectedEdge('E', 'F', 10);
  g.addDirectedEdge('B', 'G', 9);
  g.addDirectedEdge('E', 'G', 50);

  const result = abstractSearch(
    'A',
    (c) => c.charCodeAt(0).toString(),
    (c) => g.getNextNode(c),
    (c1, c2) => g.getDistance(c1, c2),
    (c) => false
  );

  expect(result[0]).toBe(undefined);
  expect(
    Array.from(result[1].entries())
      .map((e) => ({ node: e[1].node, distance: e[1].distance }))
      .sort((a, b) => a.node.charCodeAt(0) - b.node.charCodeAt(0))
      .map((e) => e.node + ': ' + e.distance)
      .join(', ')
  ).toBe('A: 0, B: 3, C: 7, D: 4, E: 12, F: 22, G: 12');
});

test('toStringFromSeconds', () => {
  // 上1桁が0の場合は省略される
  // 第2引数がtrueの場合は、秒の2桁が表示される

  expect(toStringFromSeconds(0, true)).toBe('00000');
  expect(toStringFromSeconds(0, false)).toBe('000');
  expect(toStringFromSeconds(60, true)).toBe('00100');
  expect(toStringFromSeconds(60, false)).toBe('001');
  expect(toStringFromSeconds(60 * 60, true)).toBe('10000');
  expect(toStringFromSeconds(60 * 60, false)).toBe('100');
  expect(toStringFromSeconds(10 * 60 * 60, true)).toBe('100000');
  expect(toStringFromSeconds(10 * 60 * 60, false)).toBe('1000');
  expect(toStringFromSeconds(10 * 60 * 60 + 1, true)).toBe('100001');
  expect(toStringFromSeconds(10 * 60 * 60 + 1, false)).toBe('1000');
  expect(toStringFromSeconds(10 * 60 * 60 + 30, true)).toBe('100030');
  expect(toStringFromSeconds(10 * 60 * 60 + 30, false)).toBe('1000');
});

test('parseTime HM 正常系', () => {
  // 上1桁が0の場合は省略しても解釈される
  expect(parseTime('000', false)).toBe(0);
  expect(parseTime('001', false)).toBe(60);
  expect(parseTime('100', false)).toBe(60 * 60);
  // 上1桁が0の場合に入力しても解釈される
  expect(parseTime('0000', false)).toBe(0);
  expect(parseTime('0001', false)).toBe(60);
  expect(parseTime('0100', false)).toBe(60 * 60);

  expect(parseTime('1000', false)).toBe(10 * 60 * 60);
  expect(parseTime('1001', false)).toBe(10 * 60 * 60 + 60);
  expect(parseTime('1010', false)).toBe(10 * 60 * 60 + 10 * 60);
  expect(parseTime('1111', false)).toBe(11 * 60 * 60 + 11 * 60);
  // 第2引数がfalseの場合は5文字目以降は無視される
  expect(parseTime('111101', false)).toBe(11 * 60 * 60 + 11 * 60);
  expect(parseTime('111111', false)).toBe(11 * 60 * 60 + 11 * 60);

  // 第2引数がtrueの場合でも、桁数が4桁以下なら、秒が無いものとして解釈される
  expect(parseTime('000', true)).toBe(0);
  expect(parseTime('001', true)).toBe(60);
  expect(parseTime('100', true)).toBe(60 * 60);
  expect(parseTime('0000', true)).toBe(0);
  expect(parseTime('0001', true)).toBe(60);
  expect(parseTime('0100', true)).toBe(60 * 60);
  expect(parseTime('1000', true)).toBe(10 * 60 * 60);
  expect(parseTime('1001', true)).toBe(10 * 60 * 60 + 60);
  expect(parseTime('1010', true)).toBe(10 * 60 * 60 + 10 * 60);
  expect(parseTime('1111', true)).toBe(11 * 60 * 60 + 11 * 60);
});

test('parseTime HM 異常系', () => {
  // 空
  expect(parseTime('', false)).toBe(undefined);
  // 桁数が足りない
  expect(parseTime('a', false)).toBe(undefined);
  expect(parseTime('1', false)).toBe(undefined);
  expect(parseTime('11', false)).toBe(undefined);
  // parseIntが失敗
  expect(parseTime('aa00', false)).toBe(undefined);
  // 時間と分が範囲外
  expect(parseTime('2400', false)).toBe(undefined);
  expect(parseTime('0060', false)).toBe(undefined);

  // 第2引数がtrueの場合も同様
  expect(parseTime('', true)).toBe(undefined);
  expect(parseTime('a', true)).toBe(undefined);
  expect(parseTime('1', true)).toBe(undefined);
  expect(parseTime('11', true)).toBe(undefined);
  expect(parseTime('aa00', true)).toBe(undefined);
  expect(parseTime('2400', true)).toBe(undefined);
  expect(parseTime('0060', true)).toBe(undefined);
});

test('parseTime HMS 正常系', () => {
  expect(parseTime('00000', true)).toBe(0);
  expect(parseTime('00100', true)).toBe(60);
  expect(parseTime('10000', true)).toBe(60 * 60);
  expect(parseTime('000000', true)).toBe(0);
  expect(parseTime('000100', true)).toBe(60);
  expect(parseTime('010000', true)).toBe(60 * 60);
  expect(parseTime('100000', true)).toBe(10 * 60 * 60);
  expect(parseTime('100100', true)).toBe(10 * 60 * 60 + 60);
  expect(parseTime('101000', true)).toBe(10 * 60 * 60 + 10 * 60);
  expect(parseTime('111100', true)).toBe(11 * 60 * 60 + 11 * 60);
  expect(parseTime('111101', true)).toBe(11 * 60 * 60 + 11 * 60 + 1);
  expect(parseTime('111111', true)).toBe(11 * 60 * 60 + 11 * 60 + 11);
});

test('parseTimeHMS 異常系', () => {
  expect(parseTime('', true)).toBe(undefined);
  expect(parseTime('aa00', true)).toBe(undefined); // ?
  expect(parseTime('aa0000', true)).toBe(undefined);
  expect(parseTime('240000', true)).toBe(undefined);
  expect(parseTime('006000', true)).toBe(undefined);
  expect(parseTime('000060', true)).toBe(undefined);
});

test('upto', () => {
  expect(upto(5)).toStrictEqual([0, 1, 2, 3, 4]);
  expect(upto(0)).toStrictEqual([]);
});

test('sum', () => {
  expect(sum([1, 2, 3])).toBe(6);
});

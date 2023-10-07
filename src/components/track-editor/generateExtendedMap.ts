import { assert } from '../../common';
import { ExtendedGameMap } from '../../mapEditorModel';
import { Point } from '../../model';
import { perlin2, seed } from '../../perlin';
import { ExtendedCellConstruct, ExtendedCellRoad } from '../extendedMapModel';

// オクターブをする (https://qiita.com/keny30827/items/f4e29a4a90779cf94da6#%E3%82%AA%E3%82%AF%E3%82%BF%E3%83%BC%E3%83%96%E3%83%90%E3%83%AA%E3%83%A5%E3%83%BC%E3%83%8E%E3%82%A4%E3%82%BA のコードの移植)
function perlin2Octave(x: number, y: number): number {
  let a = 1;
  let f = 1 / 8; // TODO
  let maxValue = 0;
  let totalValue = 0;
  let per = 0.5;
  for (let i = 0; i < 5; i++) {
    totalValue += a * perlin2(x * f, y * f);
    maxValue += a;
    a *= per;
    f *= 2;
  }
  return totalValue / maxValue;
}

export function generateTerrain(extendedMap: ExtendedGameMap) {
  seed(Math.random());

  for (let x = 0; x < extendedMap.length; x++) {
    for (let y = 0; y < extendedMap[0].length; y++) {
      const extendedCell = extendedMap[x][y];
      const perlinValue = Math.abs(perlin2Octave(x / 10, y / 10));
      if (perlinValue < 0.1) {
        extendedCell.terrain = 'Water';
      } else if (perlinValue < 0.28) {
        extendedCell.terrain = 'Grass';
      } else {
        extendedCell.terrain = 'Mountain';
      }
    }
  }

  generateTowns(extendedMap);
  // generateByWFC(extendedMap);
}

const ChunkSize = 30;
const TownSize = 3;

export interface ConstructCounts {
  house: number;
  shop: number;
  office: number;
}

export interface TownData {
  center: Point;
  size: number;
  constructCounts: ConstructCounts;
}

function getConstructRate() {
  const houseRate = Math.random() + 0.4;
  const shopRate = Math.random() + 0.1;
  const officeRate = Math.random() + 0.08;
  const total = houseRate + shopRate + officeRate;

  return {
    houseRate: houseRate / total,
    shopRate: shopRate / total,
    officeRate: officeRate / total,
  };
}

function generateTowns(extendedMap: ExtendedGameMap): TownData[] {
  const townDatas = [];
  for (let x = 0; x < extendedMap.length / ChunkSize; x++) {
    for (let y = 0; y < extendedMap[0].length / ChunkSize; y++) {
      const basePoint = { x: x * ChunkSize, y: y * ChunkSize };
      const center = getTownCenter(basePoint, extendedMap);
      if (center) {
        const r = Math.random();
        const townSize = TownSize + Math.floor(r * 32);
        const randomCoefficient = 1.5 + r * 3.5;
        const constructCounts = generateTown(extendedMap, center, townSize, randomCoefficient);
        townDatas.push({ center, size: townSize, constructCounts });
      }
    }
  }

  return townDatas;
}

function getTownCenter(basePoint: Point, extendedMap: ExtendedGameMap) {
  const tempCenter = { x: Math.floor(Math.random() * ChunkSize), y: Math.floor(Math.random() * ChunkSize) };
  for (let x = 0; x < ChunkSize; x++) {
    for (let y = 0; y < ChunkSize; y++) {
      const point = {
        x: basePoint.x + ((tempCenter.x + x) % ChunkSize),
        y: basePoint.y + ((tempCenter.y + y) % ChunkSize),
      };
      if (point.x >= extendedMap.length || point.y >= extendedMap[0].length) continue;
      if (extendedMap[point.x][point.y].terrain === 'Grass') {
        return point;
      }
    }
  }

  return null;
}

function generateTown(extendedMap: ExtendedGameMap, center: Point, townSize: number, randomCoefficient: number) {
  const rates = getConstructRate();

  let constructCounts = {
    house: 0,
    shop: 0,
    office: 0,
  };
  for (let x = Math.max(0, center.x - townSize); x < Math.min(extendedMap.length, center.x + townSize); x++) {
    for (let y = Math.max(0, center.y - townSize); y < Math.min(extendedMap[0].length, center.y + townSize); y++) {
      const extendedCell = extendedMap[x][y];
      if (extendedCell.terrain !== 'Grass') continue;

      const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
      if (Math.random() < normalDistribution(distance, 0, 3) * randomCoefficient) {
        // ここらへんのパラメータを調整
        extendedCell.type = 'Construct';
        const r = Math.random();
        if (r < rates.houseRate) {
          (extendedCell as ExtendedCellConstruct).constructType = 'House';
          constructCounts.house++;
        } else if (r < rates.houseRate + rates.shopRate) {
          (extendedCell as ExtendedCellConstruct).constructType = 'Shop';
          constructCounts.shop++;
        } else {
          (extendedCell as ExtendedCellConstruct).constructType = 'Office';
          constructCounts.office++;
        }
      }
    }
  }

  if ((extendedMap[center.x][center.y] as ExtendedCellConstruct).constructType !== 'Office') {
    extendedMap[center.x][center.y].type = 'Construct';
    (extendedMap[center.x][center.y] as ExtendedCellConstruct).constructType = 'Office';
  }

  return constructCounts;
}

// 正規分布の確率密度関数
function normalDistribution(x: number, mu: number, sigma: number) {
  return (1 / (Math.sqrt(2 * Math.PI) * sigma)) * Math.exp(-Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2)));
}

type CandidateCell = {
  v: boolean;
  h: boolean;
  c: boolean;
  point: Point;
};

type CandidateCellProbabilities = {
  v: number;
  h: number;
  c: number;
};

function getEntropy(prob: CandidateCellProbabilities): number {
  const sum = prob.v + prob.h + prob.c;
  if (sum === 0) return 0;
  prob.v = prob.v / sum;
  prob.h = prob.h / sum;
  prob.c = prob.c / sum;
  return -prob.v * Math.log(prob.v) - prob.h * Math.log(prob.h) - prob.c * Math.log(prob.c);
}

function getMinEntropyCell(candidateMap: CandidateCell[][], extendedMap: ExtendedGameMap): CandidateCell | undefined {
  let minEntropy = Infinity;
  let minEntropyCells: CandidateCell[] = [];
  for (let x = 0; x < candidateMap.length; x++) {
    for (let y = 0; y < candidateMap[0].length; y++) {
      if (extendedMap[x][y].type === 'Road') continue;

      const cell = candidateMap[x][y];
      const prob = {
        v: cell.v ? 1 : 0,
        h: cell.h ? 1 : 0,
        c: cell.c ? 1 : 0,
      };
      if (!cell.v && !cell.h && !cell.c) continue;

      const entropy = getEntropy(prob);
      if (entropy < minEntropy) {
        minEntropy = entropy;
        minEntropyCells = [cell];
      } else if (entropy === minEntropy) {
        minEntropyCells.push(cell);
      }
    }
  }

  const minEntropyCell = minEntropyCells[Math.floor(Math.random() * minEntropyCells.length)];
  return minEntropyCell;
}

function generateByWFC(extendedMap: ExtendedGameMap) {
  const candidateMap: CandidateCell[][] = [];
  for (let x = 0; x < extendedMap.length; x++) {
    const column = [];
    for (let y = 0; y < extendedMap[0].length; y++) {
      column.push({
        v: true,
        h: true,
        c: true,
        point: { x, y },
      });
    }
    candidateMap.push(column);
  }

  while (true) {
    const minEntropyCell = getMinEntropyCell(candidateMap, extendedMap);
    if (!minEntropyCell) break;

    const { x, y } = minEntropyCell.point;
    const cell = extendedMap[x][y] as ExtendedCellRoad;

    if (minEntropyCell.v && minEntropyCell.h && minEntropyCell.c) {
      cell.type = 'Road';
      const r = Math.random();
      if (r < 0.3) {
        cell.crossRoad = true;
      } else if (r < 0.6) {
        cell.rightRoad = true;
        cell.leftRoad = true;
      } else {
        cell.topRoad = true;
        cell.bottomRoad = true;
      }
    } else if (minEntropyCell.v) {
      cell.type = 'Road';
      cell.topRoad = true;
      cell.bottomRoad = true;
    } else if (minEntropyCell.h) {
      cell.type = 'Road';
      cell.rightRoad = true;
      cell.leftRoad = true;
    } else if (minEntropyCell.c) {
      cell.type = 'Road';
      cell.crossRoad = true;
    } else {
      assert(false);
    }

    // 制約を更新
    const queue: Point[] = [];
    queue.push({ x: x - 1, y });
    queue.push({ x: x + 1, y });
    queue.push({ x, y: y - 1 });
    queue.push({ x, y: y + 1 });

    const seen = new Set<string>();

    while (queue.length > 0) {
      const point = queue.shift()!;
      if (point.x < 0 || point.y < 0 || point.x >= extendedMap.length || point.y >= extendedMap[0].length) continue;
      const cell = extendedMap[point.x][point.y];
      if (cell.type === 'Road') continue;

      const candidateCell = candidateMap[point.x][point.y];

      {
        const eCell = getCell(extendedMap, point.x - 1, point.y);
        const cCell = getCell(candidateMap, point.x - 1, point.y);
        if (eCell && cCell) {
          if (eCell.type === 'Road' && (eCell.rightRoad || eCell.leftRoad)) {
            candidateCell.v = false;
          }
          if (eCell.type === 'Road' && (eCell.bottomRoad || eCell.topRoad)) {
            candidateCell.h = false;
            candidateCell.c = false;
          }
          if (eCell.type === 'Road' && eCell.crossRoad) {
            candidateCell.v = false;
          }
          if (cCell.v && !cCell.h && !cCell.c) {
            candidateCell.h = false;
            candidateCell.c = false;
          }
          if (!cCell.v && cCell.h && !cCell.c) {
            candidateCell.v = false;
          }
          if (!cCell.v && !cCell.h && cCell.c) {
            candidateCell.v = false;
          }
        }
      }

      {
        const eCell = getCell(extendedMap, point.x + 1, point.y);
        const cCell = getCell(candidateMap, point.x + 1, point.y);
        if (eCell && cCell) {
          if (eCell.type === 'Road' && (eCell.rightRoad || eCell.leftRoad)) {
            candidateCell.v = false;
          }
          if (eCell.type === 'Road' && (eCell.bottomRoad || eCell.topRoad)) {
            candidateCell.h = false;
            candidateCell.c = false;
          }
          if (eCell.type === 'Road' && eCell.crossRoad) {
            candidateCell.v = false;
          }
          if (cCell.v && !cCell.h && !cCell.c) {
            candidateCell.h = false;
            candidateCell.c = false;
          }
          if (!cCell.v && cCell.h && !cCell.c) {
            candidateCell.v = false;
          }
          if (!cCell.v && !cCell.h && cCell.c) {
            candidateCell.v = false;
          }
        }
      }

      {
        const eCell = getCell(extendedMap, point.x, point.y - 1);
        const cCell = getCell(candidateMap, point.x, point.y - 1);
        if (eCell && cCell) {
          if (eCell.type === 'Road' && (eCell.rightRoad || eCell.leftRoad)) {
            candidateCell.v = false;
            candidateCell.c = false;
          }
          if (eCell.type === 'Road' && (eCell.bottomRoad || eCell.topRoad)) {
            candidateCell.h = false;
          }
          if (eCell.type === 'Road' && eCell.crossRoad) {
            candidateCell.h = false;
          }
          if (cCell.v && !cCell.h && !cCell.c) {
            candidateCell.h = false;
          }
          if (!cCell.v && cCell.h && !cCell.c) {
            candidateCell.v = false;
            candidateCell.c = false;
          }
          if (!cCell.v && !cCell.h && cCell.c) {
            candidateCell.h = false;
          }
        }
      }
      {
        const eCell = getCell(extendedMap, point.x, point.y + 1);
        const cCell = getCell(candidateMap, point.x, point.y + 1);
        if (eCell && cCell) {
          if (eCell.type === 'Road' && (eCell.rightRoad || eCell.leftRoad)) {
            candidateCell.v = false;
            candidateCell.c = false;
          }
          if (eCell.type === 'Road' && (eCell.bottomRoad || eCell.topRoad)) {
            candidateCell.h = false;
          }
          if (eCell.type === 'Road' && eCell.crossRoad) {
            candidateCell.h = false;
          }
          if (cCell.v && !cCell.h && !cCell.c) {
            candidateCell.h = false;
          }
          if (!cCell.v && cCell.h && !cCell.c) {
            candidateCell.v = false;
            candidateCell.c = false;
          }
          if (!cCell.v && !cCell.h && cCell.c) {
            candidateCell.h = false;
          }
        }
      }

      if (!seen.has(`${point.x - 1},${point.y}`)) {
        seen.add(`${point.x - 1},${point.y}`);
      }
      if (!seen.has(`${point.x + 1},${point.y}`)) {
        seen.add(`${point.x + 1},${point.y}`);
      }
      if (!seen.has(`${point.x},${point.y - 1}`)) {
        seen.add(`${point.x},${point.y - 1}`);
      }
      if (!seen.has(`${point.x},${point.y + 1}`)) {
        seen.add(`${point.x},${point.y + 1}`);
      }
    }
  }
}

function getCell<T>(map: T[][], x: number, y: number): T | undefined {
  if (x < 0 || y < 0 || x >= map.length || y >= map[0].length) return undefined;
  return map[x][y];
}

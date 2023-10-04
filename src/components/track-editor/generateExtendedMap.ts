import { ExtendedGameMap } from '../../mapEditorModel';
import { Point } from '../../model';
import { perlin2, seed } from '../../perlin';
import { ExtendedCellConstruct } from '../extendedMapModel';

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

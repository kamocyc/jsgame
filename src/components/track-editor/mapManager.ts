import { ExtendedGameMap, RailwayLine } from '../../mapEditorModel';
import { ConstructType, ExtendedCell, ExtendedCellConstruct, toCellPosition } from '../extendedMapModel';
import { PlacedTrain } from './trainMoveBase';

/**
 * 路線の運行頻度を取得する
 * 統計情報やダイヤを元にした値を取得したいとおろだが、とりあえずは路線長を運行中の車両数で割ったものを返す
 * @param railwayLine
 * @param placedTrains
 * @returns
 */
export function getFrequencyOfRailwayLine(railwayLine: RailwayLine, placedTrains: PlacedTrain[]) {
  const operatingTrains = placedTrains.filter((t) => t.placedRailwayLineId === railwayLine.railwayLineId);
  return operatingTrains.length / railwayLine.stops.map((s) => s.platformPaths).flat().length;
}

function getTile(extendedMap: ExtendedGameMap, x: number, y: number) {
  if (x < 0 || y < 0) return undefined;
  if (y >= extendedMap[0].length || x >= extendedMap.length) return undefined;
  return extendedMap[x][y];
}

/**
 * マップの自動発展とかを管理するクラス
 */
export class MapManager {
  readonly affectedArea = 3;

  constructor() {}

  tick(extendedMap: ExtendedGameMap, railwayLines: RailwayLine[], placedTrains: PlacedTrain[], shouldAutoGrow: boolean): boolean {
    if (!shouldAutoGrow) return false;

    // railwayLineの駅の周辺を発展させる。
    // 産業の発展を基本として、そこへの到達時分で、とかやりたいが、難しそう。
    // 適当に町が自動発展して、ダイヤに応じて人が動けばおもしろいはず
    let updated = false;

    for (const railwayLine of railwayLines) {
      const frequency = getFrequencyOfRailwayLine(railwayLine, placedTrains);

      for (const stop of railwayLine.stops) {
        const track = stop.platformTrack;

        // stopの周囲が空き地なら一定確率で何かを立てる
        for (let x = -this.affectedArea; x <= this.affectedArea; x++) {
          for (let y = -this.affectedArea; y <= this.affectedArea; y++) {
            const trackCellPosition = toCellPosition(track.begin);
            const tile: ExtendedCell | undefined = getTile(
              extendedMap,
              trackCellPosition.cx + x,
              trackCellPosition.cy + y
            );
            if (tile === undefined) continue;
            if (tile.type !== 'None') continue;

            const createConstructType = getCreateConstructType(x, y, frequency);
            if (createConstructType !== 'None') {
              (tile as ExtendedCell).type = 'Construct';
              (tile as ExtendedCell as ExtendedCellConstruct).constructType = createConstructType;
              updated = true;
            }
          }
        }
      }
    }

    return updated;
  }
}

/**
 * 町の発展を決める。ガウス分布とかでやりたいが、とりあえずは距離に応じて確率を変える
 */
export function getCreateConstructType(x: number, y: number, frequency: number): ConstructType | 'None' {
  const r = Math.random();

  const thresholds = {
    House: 0,
    Shop: 0,
    Office: 0,
  };
  const distance = Math.max(Math.abs(x), Math.abs(y));
  if (distance === 0) {
    return 'None';
  } else if (distance === 1) {
    thresholds.House = 0.1;
    thresholds.Shop = 0.9;
    thresholds.Office = 0.5;
  } else if (distance === 2) {
    thresholds.House = 0.2;
    thresholds.Shop = 0.8;
    thresholds.Office = 0.6;
  } else if (distance === 3) {
    thresholds.House = 0.8;
    thresholds.Shop = 0.2;
    thresholds.Office = 0.1;
    // } else if (distance === 4) {
    //   thresholds.House = 0.5;
    //   thresholds.Shop = 0.05;
    //   thresholds.Office = 0.05;
    // } else if (distance === 5) {
    //   thresholds.House = 0.2;
    //   thresholds.Shop = 0;
    //   thresholds.Office = 0;
  } else {
    throw new Error();
  }

  const createConstructs: ConstructType[] = [];
  if (r < thresholds.House * frequency * 0.01) createConstructs.push('House');
  if (r < thresholds.Shop * frequency * 0.01) createConstructs.push('Shop');
  if (r < thresholds.Office * frequency * 0.01) createConstructs.push('Office');

  return createConstructs[Math.floor(Math.random() * createConstructs.length)] ?? 'None';
}

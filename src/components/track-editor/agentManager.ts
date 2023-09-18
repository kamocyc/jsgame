import { assert } from '../../common';
import { CellHeight, CellWidth, ExtendedGameMap, GameMap, timesVector } from '../../mapEditorModel';
import { DiaTime, OutlinedTimetable, Point, Station, Track } from '../../model';
import { getDistance, getMidPoint } from '../../trackUtil';
import { ExtendedCellConstruct } from '../extendedMapModel';

export type AgentStatus = 'Idle' | 'Move';

interface CellPoint {
  cx: number;
  cy: number;
}

type StationPath = [Station, DiaTime][];

type AgentPath = (
  | {
      stepType: 'station';
      path: [Station, DiaTime];
    }
  | {
      stepType: 'walk';
      direction: 'up' | 'down' | 'left' | 'right';
      destination: CellPoint;
    }
)[];

export interface Agent {
  id: string;
  name: string;
  position: Point;
  status: AgentStatus;
  destination: ExtendedCellConstruct | null;
  path: AgentPath;
}

function removeNull<T>(array: (T | null)[]): T[] {
  return array.filter((x) => x !== null) as T[];
}

function getAdjacentStations(
  currentStation: Station,
  timetable: OutlinedTimetable,
  currentTime: number
): (readonly [DiaTime, number])[] {
  // 時刻表上での次の駅と到着時間を取得する
  const nextStations = removeNull(
    timetable.inboundTrains.map((train) => {
      const nextStation = (() => {
        const i = train.diaTimes.findIndex((diaTime) => diaTime.station.stationId === currentStation.stationId);
        if (i === -1 || i >= train.diaTimes.length - 1) {
          return null;
        } else {
          return train.diaTimes[i + 1];
        }
      })();

      // 次の駅がない場合はnullを返す
      if (nextStation === null) {
        return null;
      }

      const nextStationArrivalTime = nextStation.arrivalTime || nextStation.departureTime;
      assert(nextStationArrivalTime !== null, 'nextStationArrivalTime is null');

      // 次の駅の到着時間が現在時刻よりも前の場合はnullを返す
      if (nextStationArrivalTime < currentTime) {
        return null;
      }

      return [nextStation, nextStationArrivalTime] as const;
    })
  );

  return nextStations;
}

function getStationPositions(stations: Station[], gameMap: GameMap) {
  const platforms = gameMap
    .map((row) =>
      row
        .filter((cell) => cell.lineType !== null)
        .map((cell) => (cell as any).tracks as Track[])
        .flat()
    )
    .flat()
    .filter((track) => track.track.platform !== null);
  const stations_ = stations.map((station) => {
    // ホームは横向きになっている。その一番上と下のセルを取得する
    const stationPlatforms = platforms.filter((p) => p.track.platform!.station.stationId === station.stationId);
    stationPlatforms.sort((a, b) => a.begin.y - b.begin.y);
    const topPlatform = stationPlatforms[0];
    const bottomPlatform = stationPlatforms[stationPlatforms.length - 1];
    return {
      station: station,
      top: topPlatform,
      topPosition: getMidPoint(topPlatform.begin, topPlatform.begin),
      bottom: bottomPlatform,
      bottomPosition: getMidPoint(bottomPlatform.begin, bottomPlatform.begin),
    };
  });
  return stations_;
}

export function createAgentPath(
  stations: Station[],
  agent: Agent,
  gameMap: GameMap,
  currentTime: number,
  timetable: OutlinedTimetable
): AgentPath {
  // 現在地から最も近い駅を探す
  const stationPositions = getStationPositions(stations, gameMap);

  function addTopPosition(position: Point): Point {
    return {
      x: position.x,
      y: position.y + CellHeight / 2,
    };
  }

  function addBottomPosition(position: Point): Point {
    return {
      x: position.x,
      y: position.y - CellHeight / 2,
    };
  }

  function toCellPosition(position: Point): Point {
    return {
      x: Math.floor(position.x / CellWidth),
      y: Math.floor(position.y / CellHeight),
    };
  }

  function getNearestStation(currentPosition: Point) {
    const nearestStation = stationPositions.reduce((a, b) => {
      const aDistanceTop = getDistance(addTopPosition(a.topPosition), currentPosition);
      const aDistanceBottom = getDistance(addBottomPosition(a.bottomPosition), currentPosition);
      const bDistanceTop = getDistance(addTopPosition(b.topPosition), currentPosition);
      const bDistanceBottom = getDistance(addBottomPosition(b.bottomPosition), currentPosition);
      const aDistance = aDistanceTop < aDistanceBottom ? aDistanceTop : aDistanceBottom;
      const bDistance = bDistanceTop < bDistanceBottom ? bDistanceTop : bDistanceBottom;
      return aDistance < bDistance ? a : b;
    });

    return nearestStation;
  }

  const nearestStation = getNearestStation(agent.position);
  const destinationNearestStation = getNearestStation(agent.destination!.position);

  // 横、縦の順で移動する。
  const nearestStationCellPosition = toCellPosition(nearestStation.topPosition);
  const destinationNearestStationCellPosition = toCellPosition(destinationNearestStation.topPosition);
  console.log({ nearestStation });
  console.log({ destinationNearestStation });
  console.log({ nearestStationCellPosition });
  console.log({ destinationNearestStationCellPosition });

  console.log({ agent });
  const agentCellPosition = toCellPosition(agent.position);
  const agentDestinationCellPosition = toCellPosition(agent.destination!.position);
  console.log({ agentCellPosition });
  console.log({ agentDestinationCellPosition });

  const stationPath = SearchPath(nearestStation.station, currentTime, destinationNearestStation.station, timetable)[1];
  if (stationPath === null) {
    return [];
  }

  const path: AgentPath = [
    {
      stepType: 'walk',
      direction: agentCellPosition.x < nearestStationCellPosition.x ? 'right' : 'left',
      destination: {
        cx: nearestStationCellPosition.x,
        cy: agentCellPosition.y,
      },
    },
    {
      stepType: 'walk',
      direction: agentCellPosition.y < nearestStationCellPosition.y ? 'down' : 'up',
      destination: {
        cx: nearestStationCellPosition.x,
        cy: nearestStationCellPosition.y,
      },
    },
    ...stationPath.map((station) => ({
      stepType: 'station' as const,
      path: station,
    })),
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.y < agentDestinationCellPosition.y ? 'up' : 'down',
      destination: {
        cx: destinationNearestStationCellPosition.x,
        cy: agentDestinationCellPosition.y,
      },
    },
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.x < agentDestinationCellPosition.x ? 'left' : 'right',
      destination: {
        cx: agentDestinationCellPosition.x,
        cy: agentDestinationCellPosition.y,
      },
    },
  ];

  return path;
}

// 時刻表を元にしてダイクストラ法で探索する
export function SearchPath(
  initialPosition: Station,
  startTime: number,
  destination: Station,
  timetable: OutlinedTimetable
): readonly [readonly [Station, number][], StationPath | null] {
  const previous: { [key: string]: [Station, DiaTime] } = {};

  // 駅ノードの初期化（未確定のノードのみ）
  let stationNodes = timetable.stations.map((station) => ({
    station: station,
    distance: station.stationId === initialPosition.stationId ? startTime : Number.MAX_SAFE_INTEGER,
  }));

  const determinedIds = new Map<string, [Station, number]>();
  let currentTime = startTime;

  while (stationNodes.length > 0) {
    // 時間が一番少ない（最小距離が最小）の駅（ノード）の距離を確定する
    const nextDetermineNode = stationNodes.reduce((a, b) => (a.distance < b.distance ? a : b));
    determinedIds.set(nextDetermineNode.station.stationId, [nextDetermineNode.station, nextDetermineNode.distance]);
    currentTime = nextDetermineNode.distance;
    stationNodes = stationNodes.filter((node) => node.station.stationId !== nextDetermineNode.station.stationId);

    const adjacentStations = getAdjacentStations(nextDetermineNode.station, timetable, currentTime).filter(
      (node_) => !determinedIds.has(node_[0].station.stationId)
    );

    for (const adjacentStation of adjacentStations) {
      const newDistance = adjacentStation[1];
      const adjacentStationNode = stationNodes.find(
        (node) => node.station.stationId === adjacentStation[0].station.stationId
      );
      assert(adjacentStationNode !== undefined, 'adjacentStationNode is undefined');
      if (newDistance < adjacentStationNode.distance) {
        adjacentStationNode.distance = newDistance;
        previous[adjacentStationNode.station.stationId] = [nextDetermineNode.station, adjacentStation[0]];
      }
    }
  }

  const path: StationPath = [];
  let currentNode = destination;
  while (currentNode !== initialPosition) {
    const previousNode = previous[currentNode.stationId];
    if (previousNode === undefined) {
      return [[...determinedIds.values()], null] as const;
    }
    path.unshift([currentNode, previousNode[1]]);
    currentNode = previousNode[0];
  }

  return [[...determinedIds.values()], path] as const;
}

export class AgentManager {
  agents: Agent[];

  constructor(
    private extendedMap: ExtendedGameMap,
    private stations: Station[],
    private gameMap: GameMap,
    private timetable: OutlinedTimetable
  ) {
    this.agents = [];
  }

  clear() {
    this.agents = [];
  }

  add(position: Point) {
    this.agents.push({
      id: 'agent-' + this.agents.length,
      name: 'Agent ' + this.agents.length,
      position: { ...position },
      status: 'Idle',
      destination: null,
      path: [],
    });
  }

  getRandomDestination(agent: Agent): ExtendedCellConstruct {
    const candidates = this.extendedMap.flatMap((row) =>
      row.filter(
        (cell) =>
          cell.type === 'Construct' &&
          getDistance(timesVector(cell.position, CellHeight), agent.position) > CellHeight * 1.4
      )
    ) as ExtendedCellConstruct[];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  actAgent(agent: Agent, currentTime: number) {
    if (agent.status === 'Idle') {
      // ランダムに目的地を決める
      if (Math.random() < 0.1) {
        const destination = this.getRandomDestination(agent);
        if (destination) {
          agent.destination = destination;
          agent.status = 'Move';
          agent.path = createAgentPath(this.stations, agent, this.gameMap, currentTime, this.timetable);
        }
      }
    } else if (agent.status === 'Move') {
      assert(agent.destination !== null, 'agent.destination is null');

      // 目的地に向かって移動する
      // セルの左下になっているけど中央とかいずれかに触れたらというほうがいいかも
      const dx = timesVector(agent.destination.position, CellHeight).x - agent.position.x;
      const dy = timesVector(agent.destination.position, CellHeight).y - agent.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 5) {
        agent.position = timesVector(agent.destination.position, CellHeight);
        agent.destination = null;
        agent.status = 'Idle';
      } else {
        agent.position = {
          x: agent.position.x + (dx / distance) * 5,
          y: agent.position.y + (dy / distance) * 5,
        };
      }
    }
  }

  tick(currentTime: number) {
    for (const agent of this.agents) {
      this.actAgent(agent, currentTime);
    }
  }
}

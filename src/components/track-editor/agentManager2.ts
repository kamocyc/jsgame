import { assert } from '../../common';
import { CellHeight, CellWidth, ExtendedGameMap, GameMap, RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import { Point, Station, generateId } from '../../model';
import { abstractSearch, getDistance } from '../../trackUtil';
import { CellPoint, ExtendedCellConstruct, toCellPosition, toPixelPosition } from '../extendedMapModel';
import { AgentManagerBase, getStationPositions } from './agentManager';
import { PlacedTrain } from './trainMoveBase';

export type AgentStatus = 'Idle' | 'Move';

type StationAndRailwayLine = {
  station: Station;
  railwayLine: RailwayLine;
  stop: RailwayLineStop;
};

type AgentPath = (
  | {
      stepType: 'station';
      stationPathStep: StationAndRailwayLine;
    }
  | {
      stepType: 'walk';
      direction: 'up' | 'down' | 'left' | 'right';
      destination: CellPoint;
    }
)[];

interface Agent {
  id: string;
  name: string;
  position: Point;
  status: AgentStatus;
  destination: ExtendedCellConstruct | null;
  inDestination: boolean;
  path: AgentPath;
  pathIndex: number;
  placedTrain: PlacedTrain | null;
}

export function createAgentPath(
  stations: Station[],
  agent: Agent,
  gameMap: GameMap,
  railwayLines: RailwayLine[]
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

  const agentCellPosition = toCellPosition(agent.position);
  const agentDestinationCellPosition = agent.destination!.position;
  // console.log({ agent });
  // console.log({ agentCellPosition });
  // console.log({ agentDestinationCellPosition });

  function getWalkOnlyPath() {
    const path: AgentPath = [
      {
        stepType: 'walk',
        direction: agentCellPosition.cx < agentDestinationCellPosition.cx ? 'right' : 'left',
        destination: {
          cx: agentDestinationCellPosition.cx,
          cy: agentCellPosition.cy,
        },
      },
      {
        stepType: 'walk',
        direction: agentCellPosition.cy < agentDestinationCellPosition.cy ? 'down' : 'up',
        destination: {
          cx: agentDestinationCellPosition.cx,
          cy: agentDestinationCellPosition.cy,
        },
      },
    ];

    return path;
  }

  // 徒歩のみの場合
  if (stationPositions.length <= 2) {
    return getWalkOnlyPath();
  }

  const nearestStation = getNearestStation(agent.position);
  const destinationNearestStation = getNearestStation(toPixelPosition(agent.destination!.position));
  const toC = toPixelPosition;

  // 歩いたほうが近い場合は、徒歩のみのパスを返す
  if (
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentCellPosition), nearestStation.bottomPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentCellPosition), nearestStation.topPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentDestinationCellPosition), destinationNearestStation.bottomPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentDestinationCellPosition), destinationNearestStation.topPosition)
  ) {
    return getWalkOnlyPath();
  }

  // 横、縦の順で移動する。
  const nearestStationCellPosition = toCellPosition(nearestStation.topPosition);
  const destinationNearestStationCellPosition = toCellPosition(destinationNearestStation.topPosition);
  // console.log({ nearestStation });
  // console.log({ destinationNearestStation });
  // console.log({ nearestStationCellPosition });
  // console.log({ destinationNearestStationCellPosition });

  const searchFunc = (startStation: Station, destinationStation: Station) => {
    const availableRailwayLines = railwayLines.filter((line) =>
      line.stops.some((stop) => stop.platform.station.stationId === startStation.stationId)
    );
    if (availableRailwayLines.length === 0) {
      // 使える路線が無い => こういう場合はあらかじめはじくべきだが、、
      throw new Error('使える路線が無い');
      console.warn('使える路線が無い');
      return null;
    }
    const availableRailwayLine = availableRailwayLines[0]; // TODO: とりあえず最初の路線を使う
    const stop = availableRailwayLine.stops.find(
      (stop) => stop.platform.station.stationId === startStation.stationId
    );
    assert(stop !== undefined, 'stop is undefined');

    const stationAndRailwayLinePath = searchPath2(
      startStation,
      destinationStation,
      availableRailwayLine,
      stop,
      railwayLines
    )[0];
    if (stationAndRailwayLinePath == null) {
      console.warn('a is null');
      return null;
    }

    return stationAndRailwayLinePath;
  };

  const stationPath = searchFunc(nearestStation.station, destinationNearestStation.station);
  if (stationPath == null) {
    return [];
  }

  const path: AgentPath = [
    {
      stepType: 'walk',
      direction: agentCellPosition.cx < nearestStationCellPosition.cx ? 'right' : 'left',
      destination: {
        cx: nearestStationCellPosition.cx,
        cy: agentCellPosition.cy,
      },
    },
    {
      stepType: 'walk',
      direction: agentCellPosition.cy < nearestStationCellPosition.cy ? 'down' : 'up',
      destination: {
        cx: nearestStationCellPosition.cx,
        cy: nearestStationCellPosition.cy,
      },
    },
    ...stationPath.map((stationPathStep) => ({
      stepType: 'station' as const,
      stationPathStep,
    })),
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.cy < agentDestinationCellPosition.cy ? 'up' : 'down',
      destination: {
        cx: destinationNearestStationCellPosition.cx,
        cy: agentDestinationCellPosition.cy,
      },
    },
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.cx < agentDestinationCellPosition.cx ? 'left' : 'right',
      destination: {
        cx: agentDestinationCellPosition.cx,
        cy: agentDestinationCellPosition.cy,
      },
    },
  ];

  return path;
}

function getAdjacentStations2(sr: StationAndRailwayLine, railwayLines: RailwayLine[]): StationAndRailwayLine[] {
  const candidates: StationAndRailwayLine[] = [];

  // 1. 現在の路線の次の駅を取得
  const stopIndex = sr.railwayLine.stops.findIndex((s) => s.stopId === sr.stop.stopId);
  if (stopIndex === -1) {
    throw new Error('stopIndex is -1');
  }
  const nextStopIndex = stopIndex === sr.railwayLine.stops.length - 1 ? 0 : stopIndex + 1;
  const nextStop = sr.railwayLine.stops[nextStopIndex];
  const nextStation = nextStop.platform.station;
  candidates.push({
    station: nextStation,
    railwayLine: sr.railwayLine,
    stop: nextStop,
  });

  // 2. 現在の駅の別の路線の駅を取得
  const otherRailwayLineStops = railwayLines
    .filter((r) => r.railwayLineId !== sr.railwayLine.railwayLineId)
    .map((r) => r.stops.map((s) => [r, s] as const))
    .flat()
    .filter(([_, s]) => s.platform.station.stationId === sr.station.stationId);
  candidates.push(
    ...otherRailwayLineStops.map(([r, s]) => ({
      station: sr.station,
      railwayLine: r,
      stop: s,
    }))
  );

  return candidates;
}

function getDistanceBetweenStation2(sr1: StationAndRailwayLine, sr2: StationAndRailwayLine): number {
  if (sr1.railwayLine.railwayLineId === sr2.railwayLine.railwayLineId) {
    if (sr1.stop.platformPaths === null) {
      throw new Error('sr1.stop.platformPaths === null');
    }
    // 同じ路線の場合 => pathの長さを利用
    let length = 0;
    for (const path of sr1.stop.platformPaths) {
      if (
        path.track.platform?.station.stationId !== sr1.station.stationId &&
        path.track.platform?.station.stationId !== sr2.station.stationId
      ) {
        length += getDistance(path.begin, path.end) / CellWidth;
      }
      return length;
    }
  }

  // 異なる路線の場合 => 同じ駅であるはず
  if (sr1.station.stationId !== sr2.station.stationId) {
    throw new Error('sr1.station.stationId !== sr2.station.stationId');
  }

  // 乗り換え時間として適当な固定値を返す
  return 5;
}

export function searchPath2(
  initialPosition: Station,
  destination: Station,
  railwayLine: RailwayLine,
  stop: RailwayLineStop,
  railwayLines: RailwayLine[]
) {
  return abstractSearch<StationAndRailwayLine>(
    {
      station: initialPosition,
      railwayLine: railwayLine,
      stop: stop,
    },
    (sr) => sr.station.stationId + '__' + sr.railwayLine.railwayLineId + '__' + sr.stop.stopId,
    (sr) => getAdjacentStations2(sr, railwayLines),
    (sr1, sr2) => getDistanceBetweenStation2(sr1, sr2),
    (sr) => sr.station.stationId === destination.stationId
  );
}

function toPoint(cellPoint: CellPoint): Point {
  return {
    x: cellPoint.cx * CellWidth,
    y: cellPoint.cy * CellHeight,
  };
}

export interface AgentManager2Props {
  extendedMap: ExtendedGameMap;
  stations: Station[];
  gameMap: GameMap;
  railwayLines: RailwayLine[];
  placedTrains: PlacedTrain[]
}

// 時刻表ベースの実装
export class AgentManager2 implements AgentManagerBase {
  agents: Agent[];

  constructor() {
    this.agents = [];
  }

  clear() {
    this.agents = [];
  }
  getAgents() {
    return this.agents;
  }

  add(position: Point) {
    if (this.agents.length > 5) return ;//debug

    const id = generateId();
    this.agents.push({
      id: 'agent-' + id,
      name: 'Agent ' + id,
      position: { ...position },
      status: 'Idle',
      destination: null,
      inDestination: false,
      path: [],
      pathIndex: -1,
      placedTrain: null,
    });
  }

  remove(agentId: string) {
    this.agents = this.agents.filter((a) => a.id !== agentId);
  }

  getRandomDestination(agent: Agent, props: AgentManager2Props): ExtendedCellConstruct {
    const candidates = props.extendedMap.flatMap((row) =>
      row.filter(
        (cell) =>
          cell.type === 'Construct' && getDistance(toPixelPosition(cell.position), agent.position) > CellHeight * 1.4
      )
    ) as ExtendedCellConstruct[];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  actAgent(agent: Agent, props: AgentManager2Props) {
    if (agent.status === 'Idle') {
      // ランダムに目的地を決める
      if (Math.random() < 0.1) {
        const destination = this.getRandomDestination(agent, props);
        if (destination) {
          agent.destination = destination;
          agent.inDestination = false;
          agent.status = 'Move';
          agent.path = createAgentPath(props.stations, agent, props.gameMap, props.railwayLines);
          agent.pathIndex = 0;
        }
      }
    } else if (agent.status === 'Move') {
      assert(agent.destination !== null, 'agent.destination is null');

      if (agent.pathIndex >= agent.path.length) {
        // 目的地に到着したら
        agent.destination = null;
        agent.inDestination = true;
        agent.status = 'Idle';
        return;
      }

      const step = agent.path[agent.pathIndex];
      if (step.stepType === 'station') {
        // 駅に到着している
        if (agent.placedTrain === null) {
          // 列車のstopが同一であるものを探す
          const foundTrains = props.placedTrains.filter((t) => t.stationStatus === 'Arrived' && t.track.track.platform?.station.stationId === step.stationPathStep.station.stationId);
          if (foundTrains.length > 0) {
            const foundTrain = foundTrains[0];
            agent.placedTrain = foundTrain;
            agent.pathIndex ++;
          }
        } else if (agent.placedTrain !== null) {
          // 電車に乗っている途中
          agent.position = { ...agent.placedTrain.position };

          // 電車から降りる
          if (
            agent.placedTrain.stationStatus === 'Arrived' &&
            // TODO: stepが１つずれている気がする
            agent.placedTrain.track.track.platform?.station.stationId === step.stationPathStep.station.stationId
          ) {
            agent.placedTrain = null;
            // agent.pathIndex ++;
          }
        }
      } else if (step.stepType === 'walk') {
        // 歩いている途中
        const destination = toPoint(step.destination);
        const dx = destination.x - agent.position.x;
        const dy = destination.y - agent.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) {
          agent.position = destination;
          agent.pathIndex ++;
        } else {
          agent.position = {
            x: agent.position.x + (dx / distance) * 5,
            y: agent.position.y + (dy / distance) * 5,
          };
        }
      }
    }
  }

  tick(props: AgentManager2Props) {
    for (const agent of this.agents) {
      this.actAgent(agent, props);
    }
  }
}

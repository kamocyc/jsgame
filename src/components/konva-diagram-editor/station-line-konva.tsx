import { Group, Line } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { assert, nn, upto } from '../../common';
import { StationLike } from '../../model';
import { hitStrokeWidth } from './drawer-util';
import { gridColor, isStationExpandedAtom, stationPositionsAtom, stationsAtom, virtualCanvasWidth } from './konva-util';
import { getPlatformPositions } from './station-view-konva';

// 路線追加のイベントハンドラなどやりたい

export type StationPlatformLineKonvaProps = DeepReadonly<{
  station: StationLike;
}>;
export function StationPlatformLineKonva(props: StationPlatformLineKonvaProps) {
  const { station } = props;
  const stationPositions = useRecoilValue(stationPositionsAtom).stationPositions;
  const platforms = station.platforms;
  const [platformPositions, lastLinePosition] = getPlatformPositions(platforms);
  const stationPosition = nn(stationPositions.find((p) => p.stationId === station.stationId)).diagramPosition;

  return (
    <Group y={stationPosition}>
      {upto(platforms.length).map((platformIndex) => {
        const platformPosition = platformPositions[platformIndex];
        return (
          <Line
            id={`grid-line-station-platform-${station.stationId}-${platformIndex}`}
            key={platformIndex}
            points={[0, platformPosition, virtualCanvasWidth, platformPosition]}
            stroke={gridColor}
            strokeWidth={1}
          />
        );
      })}
      <Line points={[0, lastLinePosition, virtualCanvasWidth, lastLinePosition]} stroke={gridColor} strokeWidth={1} />
    </Group>
  );
}

export type StationLineKonvaProps = DeepReadonly<{
  station: StationLike;
}>;
export function StationLineKonva(props: StationLineKonvaProps) {
  const station = props.station;
  const isStationExpandedMap = useRecoilValue(isStationExpandedAtom);
  const isStationExpanded = isStationExpandedMap.get(station.stationId) ?? false;
  const stationPositions = useRecoilValue(stationPositionsAtom).stationPositions;
  const diagramPosition = stationPositions.find((x) => x.stationId === station.stationId)?.diagramPosition;
  assert(diagramPosition != null);

  return (
    <>
      <Line
        id={`grid-line-station-line-${station.stationId}`}
        points={[0, diagramPosition, virtualCanvasWidth, diagramPosition]}
        stroke={gridColor}
        strokeWidth={1}
        hitStrokeWidth={hitStrokeWidth}
      />
      {isStationExpanded ? <>{<StationPlatformLineKonva station={station} />}</> : <></>}
    </>
  );
}

export type StationLineCollectionKonvaProps = DeepReadonly<{}>;
export function StationLineCollectionKonva(props: StationLineCollectionKonvaProps) {
  const stations = useRecoilValue(stationsAtom);

  return (
    <>
      {stations.map((station) => {
        return <StationLineKonva key={station.stationId} station={station} />;
      })}
    </>
  );
}

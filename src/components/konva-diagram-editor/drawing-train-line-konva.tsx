import { Line } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { DiagramProps } from './drawer-util';
import {
  createPositionDiaTimeMap,
  drawingTrainLineAtom,
  stationMapSelector,
  stationsAtom,
  useViewStateValues,
} from './konva-util';

import { DeepReadonly } from 'ts-essentials';
import { DiaTime, StationLike, generateId } from '../../model';

export function getDiaTimeFromDrawingTrainLine(
  drawingLineTimes: DeepReadonly<{ stationId: string; platformId: string; time: number }[]>,
  diagramProps: DeepReadonly<DiagramProps>
) {
  const railwayLine = diagramProps.railwayLine;

  const diaTimes: DiaTime[] = drawingLineTimes.map((drawingLineTime, index) => {
    const platformId = drawingLineTime.platformId;
    const stopForTrackId = railwayLine.stops.find((stop) => stop.platform.platformId === platformId);
    const diaTime: DiaTime = {
      stationId: drawingLineTime.stationId,
      departureTime: index < drawingLineTimes.length - 1 ? drawingLineTime.time : null,
      arrivalTime: index > 0 ? drawingLineTime.time : null,
      diaTimeId: generateId(),
      isPassing: false,
      platformId: platformId,
      isInService: true,
      trackId: stopForTrackId?.platformTrack?.trackId ?? null,
    };
    return diaTime;
  });

  return diaTimes;
}

export function getDirectionOfDrawingTrainLine(
  drawingLineTimes: DeepReadonly<{ stationId: string; platformId: string; time: number }[]>,
  stations: DeepReadonly<StationLike[]>
) {
  // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
  const firstStationIndex = stations.findIndex((station) => station.stationId === drawingLineTimes[0].stationId);
  const secondStationIndex = stations.findIndex((station) => station.stationId === drawingLineTimes[1].stationId);
  const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
  return direction;
}

export type DrawingTrainLineKonvaProps = DeepReadonly<{ diagramProps: DiagramProps }>;

export function DrawingTrainLineKonva(props: DrawingTrainLineKonvaProps) {
  const drawingTrainLine = useRecoilValue(drawingTrainLineAtom);
  const { isDrawing, drawingLineTimes, tempDrawingLineTime } = drawingTrainLine;
  const stations = useRecoilValue(stationsAtom);
  const stationMap = useRecoilValue(stationMapSelector);
  const viewState = useViewStateValues();

  const getDrawingLine = () => {
    const drawingLineTimes_ = drawingLineTimes.concat(tempDrawingLineTime !== null ? [tempDrawingLineTime] : []);
    if (isDrawing && drawingLineTimes_.length >= 2) {
      const direction = getDirectionOfDrawingTrainLine(drawingLineTimes_, stations);
      const diaTimes = getDiaTimeFromDrawingTrainLine(drawingLineTimes_, props.diagramProps);
      const points = createPositionDiaTimeMap(stationMap, viewState, diaTimes, direction)
        .map(({ x, y }) => [x, y])
        .flat();

      // const points = drawingLineTimes
      //   .concat(tempDrawingLineTime !== null ? [tempDrawingLineTime] : [])
      //   .map(({ stationId, platformId, time }) => {
      //     const isStationExpanded = isStationExpandedMap.get(stationId) ?? false;
      //     const stationPosition = nn(stationPositions.find((s) => s.stationId === stationId)).diagramPosition;
      //     assert(stationPosition != null);
      //     if (isStationExpanded) {
      //       const station = nn(stationMap.get(stationId));
      //       const platforms = station.platforms;
      //       const [platformPositions] = getPlatformPositions(platforms);
      //       const platformIndex = platforms.findIndex((p) => p.platformId === platformId);
      //       assert(platformIndex !== -1);
      //       return [getPositionFromTime(time, secondWidth), stationPosition + platformPositions[platformIndex]];
      //     } else {
      //       return [getPositionFromTime(time, secondWidth), stationPosition];
      //     }
      //   })
      //   .flat();

      return (
        <>
          <Line stroke={'red'} strokeWidth={2} listening={false} points={points} />
        </>
      );
    } else {
      return <></>;
    }
  };

  return getDrawingLine();
}

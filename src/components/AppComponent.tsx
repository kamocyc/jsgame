import { useEffect, useState } from 'preact/hooks';
import { AppStates, Cell, GameMap, createMapContext } from '../mapEditorModel';
import { DetailedTimetable } from '../model';
import { Polygon, sat } from '../sat';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TimetableEditorComponent } from './timetable-editor/timetable-editor-component';
import { getInitialTimetable } from './timetable-editor/timetable-util';
import { ToastComponent } from './toast';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';
import { TrainMove2 } from './track-editor/trainMove2';

function initializeMap(mapWidth: number, mapHeight: number): GameMap {
  const map: Cell[][] = [];
  for (let x = 0; x < mapWidth; x++) {
    map.push([]);
    for (let y = 0; y < mapHeight; y++) {
      map[x].push({
        position: { x, y },
        lineType: null,
      } as Cell);
    }
  }
  return map;
}

const timetable: DetailedTimetable = {
  platformTTItems: [],
  switchTTItems: [],
  operations: [],
};

const defaultMapWidth = 200;
const defaultMapHeight = 20;

function TestComponent() {
  const poly1 = new Polygon([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  const poly2 = new Polygon([
    { x: 150, y: 50 },
    { x: 50, y: 50 },
  ]);

  poly2.vertices.forEach((v) => {
    v.x += 51;
  });

  useEffect(() => {
    const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    function drawPolygon(polygon: Polygon) {
      ctx.beginPath();
      ctx.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
      for (let i = 1; i < polygon.vertices.length; i++) {
        ctx.lineTo(polygon.vertices[i].x, polygon.vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    drawPolygon(poly1);
    drawPolygon(poly2);

    const result = sat(poly1, poly2);
    console.log(result);
  }, []);
  return <canvas width='1000' height='300' id='test-canvas'></canvas>;
}

export function getInitialAppStates(): AppStates {
  return {
    editMode: 'Create',
    detailedTimetable: timetable,
    timetableData: getInitialTimetable(),
    trains: [
      {
        diaTimes: [],
        trainId: '1',
        trainName: 'A',
        trainCode: '',
        direction: 'Inbound',
      },
      {
        diaTimes: [],
        trainId: '2',
        trainName: 'B',
        trainCode: '',
        direction: 'Outbound',
      },
    ],
    map: initializeMap(defaultMapWidth, defaultMapHeight),
    mapWidth: defaultMapWidth,
    mapHeight: defaultMapHeight,
    mapContext: createMapContext(defaultMapWidth, defaultMapHeight),
    trainMove: new TrainMove2(timetable),
    switches: [],
    stations: [],
    tracks: [],
    message: null,
  };
}

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => getInitialAppStates());

  return (
    <>
      <ToastComponent message={appStates.message} />
      <SplitViewComponent
        splitViews={[
          {
            splitViewId: 1,
            component: () => <TrackEditorComponent appStates={appStates} setAppStates={setAppStates} />,
          },
          {
            splitViewId: 2,
            component: () => <TimetableEditorComponent appStates={appStates} setAppStates={setAppStates} />,
          },
          // {
          //   splitViewId: 3,
          //   component: () => <TestComponent />,
          // },
        ]}
      />
    </>
  );
}

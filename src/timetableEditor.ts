import { Diagram, StationTrain } from "./model.js";

function showGlobalTime(timeSeconds: number): string {
  const m = Math.floor(timeSeconds / 60 % 60);
  return '' + Math.floor(timeSeconds / 60 / 60) + (m < 10 ? '0' + m : '' + m)
}

const rowHeight = 20;
const columnWidth = 50;

// TODO: first or errorとか
// 行の表示切替機能ほしい。駅の一部とか
// 基本的に、テキストボックスを使うとかって面倒そうなので、描画
function draw(diagram: Diagram) {
  const ctx = (document.getElementById('canvas') as HTMLCanvasElement).getContext("2d")!;
  let offsetX = 0;
  let offsetY = 0;
  
  const rowHeightMap = {
    trainName: undefined as number | undefined,
    initialStation: undefined as number | undefined,
    finalStation: undefined as number | undefined,
  };

  // 列車番号等を表示
  ctx.fillText('列車名', offsetX, offsetY);
  rowHeightMap.trainName = offsetX;
  offsetX += rowHeight;
  ctx.fillText('始発駅', offsetX, offsetY);
  rowHeightMap.initialStation = offsetX;
  offsetX += rowHeight;
  ctx.fillText('終着駅', offsetX, offsetY);
  rowHeightMap.finalStation = offsetX;
  offsetX += rowHeight;
  
  const stationYMap = new Map<number, number>();
  const stations = diagram.stations;  // これは別のほうがいい？当然stationごとに表示するものが異なるので、station基準で。
  for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
    const station = stations[stationIndex];
    ctx.fillText(station.name, offsetX, offsetY);
    
    stationYMap.set(station.stationId, offsetY);
    offsetY += rowHeight;
  }

  offsetX += columnWidth;

  for (const diaTrain of diagram.trains) {
    const timetable = diaTrain.trainTimetable;

    ctx.fillText(diaTrain.name, offsetX, rowHeightMap.trainName);
    ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[0].stationId)[0].name, offsetX, rowHeightMap.finalStation);
    ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[timetable.length - 1].stationId)[0].name, offsetX, rowHeightMap.finalStation);

    for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
      const ttItem = timetable[timeIndex];

      // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
      // 上下に分かれて表示されるのは紙の時刻表に由来する。横とかのほうがわかりやすい？そうでもないか。
      const positionY = stationYMap.get(ttItem.stationId);
      if (positionY === undefined) {
        throw new Error('illegal stationId');
      }

      ctx.fillText(showGlobalTime(ttItem.departureTime), offsetX, positionY);
    }

    offsetX += columnWidth;
  }

  // 罫線を書く
}
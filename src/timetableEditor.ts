// import { Diagram, StationTrain } from "./model.js";
// import { DiagramExt } from "./oudParser.js";

// function showGlobalTime(timeSeconds: number): string {
//   const m = Math.floor(timeSeconds / 60 % 60);
//   return '' + Math.floor(timeSeconds / 60 / 60) + (m < 10 ? '0' + m : '' + m)
// }

// const rowHeight = 20;
// const columnWidth = 50;

// // 縦書き 改行とか禁則処理とかいろいろ対応していないがとりあえず表示する
// function fillVerticalText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
//   text.split('').forEach(c => {
//     ctx.fillText(c, x, y);
//     const metrics = ctx.measureText(c)
//     y += metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
//   });
// }

// // DOMを使ったバージョン
// function drawTimetable_(diagram: DiagramExt) {
//   const parentNode = document.getElementById('timetable-root')!;

//   function putText(text: string, x: number, y: number) {
//     const div = document.createElement('div');
//     div.textContent = text;
//     div.style.position = 'relative';
//     div.style.left = x + 'px';
//     div.style.top = y + 'px';

//     parentNode.appendChild(div);
//   }

//   let offsetX = 0;
//   let offsetY = rowHeight;
  
//   const rowHeightMap = {
//     trainCode: undefined as number | undefined,
//     trainTypeName: undefined as number | undefined,
//     trainMei: undefined as number | undefined,
//     initialStation: undefined as number | undefined,
//     finalStation: undefined as number | undefined,
//   };

//   // 列車番号等を表示
//   putText('列車番号', offsetX, offsetY);
//   rowHeightMap.trainCode = offsetY;
//   offsetY += rowHeight;
//   putText('列車種別', offsetX, offsetY + rowHeight);
//   rowHeightMap.trainTypeName = offsetY;
//   offsetY += rowHeight + rowHeight * 2;
//   putText('列車名', offsetX, offsetY);
//   rowHeightMap.trainMei = offsetY;
//   offsetY += rowHeight;
//   putText('始発駅', offsetX, offsetY);
//   rowHeightMap.initialStation = offsetY;
//   offsetY += rowHeight;
//   putText('終着駅', offsetX, offsetY);
//   rowHeightMap.finalStation = offsetY;
//   offsetY += rowHeight;
  
//   const stationYMap = new Map<number, number>();
//   const stations = diagram.stations;  // これは別のほうがいい？当然stationごとに表示するものが異なるので、station基準で。
//   for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
//     const station = stations[stationIndex];
//     putText(station.name, offsetX, offsetY);
    
//     stationYMap.set(station.stationId, offsetY);
//     offsetY += rowHeight;
//   }

//   offsetX += columnWidth;

//   for (const diaTrain of diagram.trains) {
//     const timetable = diaTrain.trainTimetable;

//     putText(diaTrain.trainCode ?? '', offsetX, rowHeightMap.trainCode);
//     if (diaTrain.color) {
//       ctx.strokeStyle = diaTrain.color;
//       // color
//     }
//     fillVerticalText(ctx, diaTrain.trainTypeName ?? '', offsetX, rowHeightMap.trainTypeName);
//     ctx.strokeStyle = 'black';
//     putText(diaTrain.trainMei ?? '', offsetX, rowHeightMap.trainMei);  // TODO:  高さなど調整
//     putText(diagram.stations.filter(s => s.stationId === timetable[0].stationId)[0].name, offsetX, rowHeightMap.initialStation);
//     putText(diagram.stations.filter(s => s.stationId === timetable[timetable.length - 1].stationId)[0].name, offsetX, rowHeightMap.finalStation);

//     for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
//       const ttItem = timetable[timeIndex];

//       // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
//       // 上下に分かれて表示されるのは紙の時刻表に由来する。横とかのほうがわかりやすい？そうでもないか。
//       const positionY = stationYMap.get(ttItem.stationId);
//       if (positionY === undefined) {
//         throw new Error('illegal stationId');
//       }

//       putText(showGlobalTime(ttItem.departureTime), offsetX, positionY);
//     }

//     offsetX += columnWidth;
//   }
// }

// // 要素の配置で重なりは無い；エンティティとして管理して取得で来たら楽かもしれない？
// // 基本はinlineで編集だが、詳細を一覧したいときはダイアログ（吹き出し？）を表示するイメージか？
// // canvasではなくて、absolute配置でdomを使ったほうがcssの適用とか便利かもしれない。
// // TODO: first or errorとか
// // 行の表示切替機能ほしい。駅の一部とか
// // 基本的に、テキストボックスを使うとかって面倒そうなので、描画
// export function drawTimetable(diagram: DiagramExt) {
//   const ctx = (document.getElementById('canvas') as HTMLCanvasElement).getContext("2d")!;
//   let offsetX = 0;
//   let offsetY = rowHeight;
  
//   const rowHeightMap = {
//     trainCode: undefined as number | undefined,
//     trainTypeName: undefined as number | undefined,
//     trainMei: undefined as number | undefined,
//     initialStation: undefined as number | undefined,
//     finalStation: undefined as number | undefined,
//   };

//   // 列車番号等を表示
//   ctx.fillText('列車番号', offsetX, offsetY);
//   rowHeightMap.trainCode = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('列車種別', offsetX, offsetY + rowHeight);
//   rowHeightMap.trainTypeName = offsetY;
//   offsetY += rowHeight + rowHeight * 2;
//   ctx.fillText('列車名', offsetX, offsetY);
//   rowHeightMap.trainMei = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('始発駅', offsetX, offsetY);
//   rowHeightMap.initialStation = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('終着駅', offsetX, offsetY);
//   rowHeightMap.finalStation = offsetY;
//   offsetY += rowHeight;
  
//   const stationYMap = new Map<number, number>();
//   const stations = diagram.stations;  // これは別のほうがいい？当然stationごとに表示するものが異なるので、station基準で。
//   for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
//     const station = stations[stationIndex];
//     ctx.fillText(station.name, offsetX, offsetY);
    
//     stationYMap.set(station.stationId, offsetY);
//     offsetY += rowHeight;
//   }

//   offsetX += columnWidth;

//   for (const diaTrain of diagram.trains) {
//     const timetable = diaTrain.trainTimetable;

//     ctx.fillText(diaTrain.trainCode ?? '', offsetX, rowHeightMap.trainCode);
//     if (diaTrain.color) {
//       ctx.strokeStyle = diaTrain.color;
//     }
//     fillVerticalText(ctx, diaTrain.trainTypeName ?? '', offsetX, rowHeightMap.trainTypeName);
//     ctx.strokeStyle = 'black';
//     ctx.fillText(diaTrain.trainMei ?? '', offsetX, rowHeightMap.trainMei);  // TODO:  高さなど調整
//     ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[0].stationId)[0].name, offsetX, rowHeightMap.initialStation);
//     ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[timetable.length - 1].stationId)[0].name, offsetX, rowHeightMap.finalStation);

//     for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
//       const ttItem = timetable[timeIndex];

//       // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
//       // 上下に分かれて表示されるのは紙の時刻表に由来する。横とかのほうがわかりやすい？そうでもないか。
//       const positionY = stationYMap.get(ttItem.stationId);
//       if (positionY === undefined) {
//         throw new Error('illegal stationId');
//       }

//       ctx.fillText(showGlobalTime(ttItem.departureTime), offsetX, positionY);
//     }

//     offsetX += columnWidth;
//   }

//   // 罫線を書く
// }

// function onClick(x: number, y: number) {

// }
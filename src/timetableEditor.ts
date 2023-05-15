import { StationTrain } from "./model.js";

const timetable: StationTrain[] = [];

// 基本的に、テキストボックスを使うとかって面倒そうなので、描画
function draw() {
  const ctx = (document.getElementById('canvas') as HTMLCanvasElement).getContext("2d")!;
  let offsetX = 0;
  let offsetY = 0;
  for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
    const ttItem = timetable[timeIndex];

    // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
    ctx.fillText('' + ttItem.departureTime, offsetX, offsetY);

    ctx.beginPath()

  }

  // 罫線を書く
}
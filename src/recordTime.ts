import { max, min } from "./common.js";
import { draw } from "./drawer.js";
import { Diagram, TimedPositionData, Train } from "./model.js";
import { TrainMove } from "./trainMove.js";

export function loadTime() {
  let timeSpeed: number;

  fetch('./saved_time.json').then(data => data.json()).then((savedData : TimedPositionData) => {
    const trainMove = new TrainMove();

    trainMove.globalTime = savedData.minGlobalTime;
    timeSpeed = savedData.globalTimeSpeed;

    const slowButton = document.getElementById('button-speed-slow') as HTMLInputElement;
    slowButton.onclick = () => {
      timeSpeed -= 10;
    }
    const fastButton = document.getElementById('button-speed-fast') as HTMLInputElement;
    fastButton.onclick = () => {
      timeSpeed += 10;
    }

    trainMove.tracks.slice(0);
    trainMove.tracks.push(...savedData.tracks);

    let savedDataIndex = 0;

    let inClick = false;
    const seekBar = document.getElementById('seek-bar') as HTMLInputElement;
    const seekBarWidth = 1000;

    function adjustIndex() {
      if (savedDataIndex < 0) {
        savedDataIndex = 0;
        trainMove.globalTime = savedData.minGlobalTime;
      }

      if (savedDataIndex >= savedData.records.length) {
        savedDataIndex = savedData.records.length - 1;
        trainMove.globalTime = savedData.maxGlobalTime;
      }
    }

    function moveSeekBar(mouseX: number) {
      trainMove.globalTime = Math.round((savedData.maxGlobalTime - savedData.minGlobalTime) * (mouseX / seekBarWidth) + savedData.minGlobalTime);
      savedDataIndex = Math.floor((trainMove.globalTime - savedData.minGlobalTime) / savedData.globalTimeSpeed);
      adjustIndex();
    }

    seekBar.onmousedown = (e) => {
      inClick = true;
      const mouseX = e.clientX - seekBar.getBoundingClientRect().left;
      moveSeekBar(mouseX);
    }
    seekBar.onmousemove = (e) => {
      if (inClick) {
        const mouseX = e.clientX - seekBar.getBoundingClientRect().left;
        moveSeekBar(mouseX);
      }
    }
    seekBar.onmouseup = (e) => {
      inClick = false;
    }
    
    setInterval(() => {
      trainMove.trains.splice(0);
      const rawTrains = savedData.records[savedDataIndex];

      trainMove.trains.push(...rawTrains.map(rawTrain => ({
        trainId: rawTrain.trainId,
        diaTrain: {
          color: rawTrain.color,
          name: rawTrain.name,
        },
        position: rawTrain.position,
      } as Train)));

      draw(trainMove, null, null);

      trainMove.globalTime += timeSpeed / 10;
      savedDataIndex = Math.floor((trainMove.globalTime - savedData.minGlobalTime) / savedData.globalTimeSpeed);
      adjustIndex();

      const seekBar = document.getElementById('seek-bar-item') as HTMLDivElement;
      seekBar.style.left = Math.round(seekBarWidth * savedDataIndex / savedData.records.length) + 'px';

      const speedText = document.getElementById('speed-text') as HTMLDivElement;
      speedText.textContent = 'speed: ' + timeSpeed;
    }, 100 / 10 /* とりあえず10倍速まで出せるようにした。必要に応じて変える */);
  })
}

export function saveTime(trainMove: TrainMove, diagram: Diagram) {
  const minGlobalTime = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());
  const maxGlobalTime = max(diagram.trains.map(t => t.trainTimetable.map(tt => tt.departureTime)).flat());

  const records = trainMove.getRecords(diagram, minGlobalTime, maxGlobalTime);
  console.log(records);
  console.log(JSON.stringify(records));
}

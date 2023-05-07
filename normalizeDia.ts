
function interpolateTrainTimetable(timetable: StationTrain[], stations: DiaStation[]): StationTrain[] {
  const stationsI = stations.map((s, i) => [s, i] as const);
  let prevStation = stationsI.filter(s => s[0].stationId === timetable[0].stationId)[0];
  const timetableResult: StationTrain[] = [timetable[0]]

  for (let i = 1; i < timetable.length; i ++) {
    let station = stationsI.filter(s => s[0].stationId === timetable[i].stationId)[0];
    if (station[1] !== prevStation[1] + 1) {
      const prevTime = timetable[i - 1].departureTime;
      const currTime = timetable[i].arrivalTime;
      const prevDistance = prevStation[0].distance;
      const currDistance = station[0].distance;
      const newTimes: (readonly [number, DiaStation])[] = [];
      for (let j = prevStation[1] + 1; j < station[1]; j++) {
        // 距離で等分する
        const time = prevTime + (currTime - prevTime) * (stations[j].distance - prevDistance) / (currDistance - prevDistance);
        newTimes.push([time, stations[j]] as const);
      }
      const newTT = newTimes.map(([time, station]) => ({
        stationId: station.stationId,
        platformId: station.platforms[0].platformId,
        arrivalTime: time,
        departureTime: time,
      }));
      timetableResult.push(...newTT);
    }
    timetableResult.push(timetable[i]);
    prevStation = station;
  }
  
  // console.log({
  //   timetable,
  //   timetableResult
  // })

  return timetableResult;
}

function normalizeDia(diagram: Diagram) {
  // 同じ時間に同じホームに列車がいたら、同じ駅の別のホームに変更する
  const stations = diagram.stations;
  const trains = diagram.trains;

  // ずらした後で重複した場合は対応していない
  // 閉塞区間 x 時間間隔 のbitマップを作るとかで対応が必要
  // さらに、特急の通過の場合、通貨時分が入っていないので、対応していない => デフォルトで待避線側に入れるとかする？
  // 閉塞の仕組
  // trackがあるので、取れる。
  // 駅の乳腺のタイミングを取って、trackが占有されていない晩戦に入れる
  let outerTrainIndex = 0;
  for(const train1 of trains) {
    for(const train2 of trains.slice(outerTrainIndex + 1)) {
      const trainTimetable1 = interpolateTrainTimetable(train1.trainTimetable, stations);
      const trainTimetable2 = interpolateTrainTimetable(train2.trainTimetable, stations);

      // 時間 x ホームの重複チェック
      for (const tt1 of trainTimetable1) {
        const matchedTts = trainTimetable2.filter(tt2 => tt2.stationId === tt1.stationId && tt2.platformId === tt1.platformId);
        if (matchedTts.length > 0) {
          const matchedTt = matchedTts[0];
          // 時間の範囲の重複チェック
          if (matchedTt.departureTime >= tt1.arrivalTime && tt1.departureTime >= matchedTt.arrivalTime) {
            // 重複している
            // console.log({tt1, matchedTt, train1, train2});

            // // platformを別にする
            const station = stations.filter(s => s.stationId === matchedTt.stationId)[0];
            const anotherPlatform = station.platforms.filter(p => p.platformId !== matchedTt.platformId)[0];
            if (anotherPlatform) {
              matchedTt.platformId = anotherPlatform.platformId; 
            } else {
              console.log('交換できない駅')
            }
          }
        }
      }
    }
    outerTrainIndex ++;
  }
}

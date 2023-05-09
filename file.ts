type FileType = 'oud' | 'diafreaks';

// fieldName変更
// relationを戻す
function getDiaFreaks(buf: string): Diagram {
  function getPlatforms(obj: any) {
    return obj.map((o: any) => ({
      platformId: o.id,
      name: o.n,
    }));
  }
  function getStations(obj: any) {
    return obj.map((o: any) => ({
      stationId: o.id,
      name: o.n,
      distance: o.m,
      platforms: getPlatforms(o.t),
    }));
  }
  function getTrainTimeTable(obj: any) {
    return obj.map((o: any) => ({
      stationId: o.s,
      platformId: o.t,
      arrivalTime: o.a,
      departureTime: o.d,
    }));
  }
  function getTrains(obj: any) {
    return obj.map((o: any) => ({
      trainId: o.id,
      color: o.c,
      name: o.n,
      trainTimetable: getTrainTimeTable(o.s)
    }));
  }

  const obj = JSON.parse(buf);
  
  const stations: DiaStation[] = getStations(obj.stations);
  stations.sort((a, b) => a.distance - b.distance);
  const trains = getTrains(obj.trains);
  
  return {stations, trains};
}

function onFileSelectorChange(event: Event) {
  const file = (event.target as HTMLInputElement).files![0];
  const reader = new FileReader();
  let fileType: FileType | null = null;
  reader.addEventListener(
    "load",
    () => {
      console.log(reader.result);
      if (fileType === 'oud') {
        const r = getEkiJikokus(reader.result as string);
        console.log(r);
      } else {
        const r = getDiaFreaks(reader.result as string);
        console.log(r)
      }
    },
    false
  );

  if (file) {
    if (/.*\.oud2?$/.test(file.name)) {
      // aud形式
      fileType = 'oud';
      reader.readAsText(file, "Shift_JIS");
    } else {
      // json形式 (diafreaks)
      fileType = 'diafreaks';
      reader.readAsText(file, "utf-8");
    }
  }
}
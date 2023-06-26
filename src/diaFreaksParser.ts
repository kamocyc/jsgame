import { Platform } from './model.js';

interface DiaStation {
  stationId: string /* stationId */;
  name: string /* name */;
  distance: number /* distance */;
  platforms: Platform[] /* platforms */;
}

interface StationTrain {
  stationId: string /* stationId */;
  platformId: string /* platformId */;
  arrivalTime: number /* arrivalTime */;
  departureTime: number /* departureTime */;
}

interface DiaTrain {
  trainId: string /* trainId */;
  color?: string;
  trainName: string /* name */;
  trainTimetable: StationTrain[];
}

interface Diagram {
  stations: DiaStation[];
  trains: DiaTrain[];
}

export function getDiaFreaks(buf: string): Diagram {
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
      trainTimetable: getTrainTimeTable(o.s),
    }));
  }

  const obj = JSON.parse(buf);

  const stations: DiaStation[] = getStations(obj.stations);
  stations.sort((a, b) => a.distance - b.distance);
  const trains = getTrains(obj.trains);

  return { stations, trains };
}

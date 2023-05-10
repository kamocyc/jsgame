import { TrainMove } from "./trainMove.js";

function extractIdSub(ee: object) {
  const kk = Object.keys(ee);
  const idKks = kk.filter(kkk => kkk.indexOf('Id') > 0);
  if (idKks.length > 0) {
    const eeAfter = (ee as Record<string, unknown>)[idKks[0]];
    if (typeof eeAfter !== 'number') {
      throw new Error('Id should be number');
    }
    const r: Record<string, unknown> = {};
    r[idKks[0]] = eeAfter;
    return r;
  }
  return ee;
}

function extractId(entry: object) {
  const constructed: Record<string, unknown> = {};
  for (const k of Object.keys(entry)) {
    let ee = (entry as Record<string, unknown>)[k] as unknown;
    if (Array.isArray(ee)) {
      ee = ee.map(e => extractIdSub(e));
    } else if (typeof ee === 'object' && ee !== null) {
      ee = extractIdSub(ee);
      ee = extractId(ee as object);
    }
    constructed[k] = ee;
  }
  return constructed;
}

function restoreJsonSub(obj: object, entry: object) {
  if (typeof entry === 'object' && entry !== null) {
    const kks = Object.keys(entry).filter(k => k.indexOf('Id') > 0);
    if (kks.length === 1) {
      const kk = kks[0];
      const entityName = kk.substring(kk.indexOf('Id'));
      const entities = (obj as Record<string, unknown>)[entityName];
      if (!Array.isArray(entities)) throw new Error('Illegal JSON');
      const founds = entities.filter(e => e[kk] === (entry as Record<string, unknown>)[kk]);
      if (founds.length !== 1) throw new Error('Illegal JSON found ids');
      return founds[0]
    }
  }

  return entry;
}

function restoreJson(obj: object, entry: object) {
  const constructed: Record<string, unknown> = {};
  for (const k of Object.keys(entry)) {
    let ee = (entry as Record<string, unknown>)[k] as unknown;
    if (Array.isArray(ee)) {
      ee = ee.map(e => restoreJsonSub(obj, e));
    } else if (typeof ee === 'object' && ee !== null) {
      ee = restoreJsonSub(obj, ee);
      ee = restoreJson(obj, ee as object);
    }
    constructed[k] = ee;
  }
  return constructed;
}

export function toJSON(trainMove: TrainMove) {
  // const obj = {
  //   trains: trains.map(train => ({ ...train, track: train.track.id })),
  //   switches: switches.map(sw => ({ ...sw, fromTracks: sw.fromTracks.map(t => t.id), toTracks: sw.toTracks.map(t => t.id), _branchedTrackFrom: sw._branchedTrackFrom.id, _branchedTrackTo: sw._branchedTrackTo.id })),
  //   tracks: tracks.map(t => t.),
  //   stations: stations,
  // };
  const obj = {
    trains: trainMove.trains.map(extractId),
    switches: trainMove.switches.map(extractId),
    tracks: trainMove.tracks.map(extractId),
    stations: trainMove.stations.map(extractId),
  };

  const json = JSON.stringify(obj); 
  console.log(json);

  const obj_ = JSON.parse(json);
  // ?
  const s = restoreJson(obj_, obj_);
  console.log(s);
}

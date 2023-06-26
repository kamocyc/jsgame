import { assert } from '../../common';
import { HalfTrack, Platform, Station, generateId } from '../../model';
import { abstractSearch, getDistance, getNextTracks } from '../../trackUtil';
import { DiaTime, DiaTrain, Timetable as OutlinedTimetable } from './../timetable-editor/model';
import { getNextTrackOfBranchPattern, getNextTrackOfStraightPattern } from './trainMove2';
import { Timetable as DetailedTimetable, PlatformTimetableItem, SwitchTimetableItem } from './uiEditorModel';

function getStationDistances(platforms: (readonly [HalfTrack, Platform])[], stations: Station[]) {
  // 距離を計算する
  // platformsのtrackのうち最も左のもの
  const leftmostStation = platforms.reduce((prev, current) => {
    if (prev[0]._begin.x < current[0]._begin.x) {
      return prev;
    } else {
      return current;
    }
  });

  const rightmostStation = platforms.reduce((prev, current) => {
    if (prev[0]._begin.x > current[0]._begin.x) {
      return prev;
    } else {
      return current;
    }
  });

  const pathTracks = searchTrackPath(leftmostStation[0], rightmostStation[0]);
  if (!pathTracks) {
    return null;
  }

  // result中のstationを順にたどり、途中に経由したtracksの数を数える
  const stationDistances = new Map<string, [Station, number]>();
  for (let pathTrackIndex = 0; pathTrackIndex < pathTracks.length; pathTrackIndex++) {
    const station = pathTracks[pathTrackIndex].track.platform?.station;
    if (station && !stationDistances.has(station.stationId)) {
      stationDistances.set(station.stationId, [station, pathTrackIndex]);
    }
  }

  return [...stationDistances.values()];
}

function getInitialDiaTimes(stationDistances: [Station, number][], direction: 'Inbound' | 'Outbound') {
  const trainSpeedPixelPerFrame = 10;
  const timeSpeedSecondPerFrame = 10;
  const cellLengthPixelPerCell = 30 * 1.5;
  const coefficient = (trainSpeedPixelPerFrame / timeSpeedSecondPerFrame) * cellLengthPixelPerCell;
  const waitTimePerStation = 15;

  const diaTimes: DiaTime[] = [];
  let accumulatedWaitTime = 0;
  for (let i = 0; i < stationDistances.length; i++) {
    const [station, distance] = stationDistances[i];
    diaTimes.push({
      diaTimeId: generateId(),
      arrivalTime: i === 0 ? null : distance * coefficient + accumulatedWaitTime,
      departureTime:
        i === stationDistances.length - 1 ? null : distance * coefficient + accumulatedWaitTime + waitTimePerStation,
      isPassing: false,
      diaStation: station,
      diaPlatform: station.platforms.filter(
        (p) =>
          (direction === 'Inbound' && p.platformId === station.defaultInboundDiaPlatformId) ||
          (direction === 'Outbound' && p.platformId === station.defaultOutboundDiaPlatformId)
      )[0],
    });
    accumulatedWaitTime += waitTimePerStation;
  }

  return diaTimes;
}

export function toOutlinedTimetableStations(tracks: HalfTrack[]): OutlinedTimetable {
  const platforms = tracks.filter((t) => t.track.platform != null).map((t) => [t, t.track.platform!] as const);
  const stations = platforms.map(([t, p]) => p.station);
  // 重複を削除。ただし、順番は保持する
  const uniqueStations = stations.filter((x, i, self) => self.indexOf(x) === i);
  const stationDistances = getStationDistances(platforms, uniqueStations);

  const [inboundDiaTimes, outboundDiaTimes] = (() => {
    if (stationDistances === null) {
      return [[], []];
    }

    const inboundDiaTimes = getInitialDiaTimes(stationDistances, 'Inbound');
    const outboundDiaTimes = getInitialDiaTimes(
      [...stationDistances].reverse().map(([s, d]) => [s, stationDistances[stationDistances.length - 1][1] - d]),
      'Outbound'
    );

    return [inboundDiaTimes, outboundDiaTimes];
  })();

  return {
    stations: inboundDiaTimes.length === 0 ? uniqueStations : inboundDiaTimes.map((d) => d.diaStation),
    inboundDiaTrains: [
      {
        trainId: generateId(),
        diaTimes: inboundDiaTimes,
        trainName: 'Inbound',
      },
    ],
    outboundDiaTrains: [
      {
        trainId: generateId(),
        diaTimes: outboundDiaTimes,
        trainName: 'Outbound',
      },
    ],
  };
}

function getFirstTrackBetweenPlatforms(tracks: HalfTrack[], platform1: Platform, platform2: Platform): HalfTrack {
  const track1 = getTrackOfPlatform(tracks, platform1);
  const track2 = getTrackOfPlatform(tracks, platform2);
  if (!track1 || !track2) {
    throw new Error('Track not found');
  }

  // 最短経路を探索する
  const result = searchTrackPath(track1, track2);

  if (!result) {
    throw new Error('Route not found');
  }

  assert(result.length >= 2, 'Route not found');
  assert(result[0].trackId === track1.trackId, 'result[0].trackId !== track1.trackId');

  // 経路の最初のtrackだけはreverseになることがあるので、修正
  if (!getNextTracks(result[0]).some((track) => track.trackId === result[1].trackId)) {
    result[0] = result[0].reverseTrack;
  }

  return result[0];
}

function toPlatformTTItems(
  allTrackStations: Station[],
  tracks: HalfTrack[],
  diaTrains: DiaTrain[]
): PlatformTimetableItem[] {
  const allTrackPlatformIds = new Set<string>(allTrackStations.map((s) => s.platforms.map((p) => p.platformId)).flat());

  // platformは基本的には時刻をそのまま転記すればよい
  const platformTTItems: PlatformTimetableItem[] = [];

  for (const diaTrain of diaTrains) {
    let diaTimeIndex = 0;
    for (const diaTime of diaTrain.diaTimes) {
      if (!allTrackPlatformIds.has(diaTime.diaPlatform.platformId)) {
        throw new Error('Platform not found in allTrackStations (' + diaTime.diaPlatform.platformId + ')');
      }

      // trackの方向を決定する
      const track = (() => {
        if (diaTimeIndex === diaTrain.diaTimes.length - 1) {
          return null;
        }
        const track1 = getTrackOfPlatform(tracks, diaTrain.diaTimes[diaTimeIndex].diaPlatform);
        const track2 = getTrackOfPlatform(tracks, diaTrain.diaTimes[diaTimeIndex + 1].diaPlatform);
        if (!track1 || !track2) {
          throw new Error('Track not found');
        }

        // 最短経路を探索する
        const result = searchTrackPath(track1, track2);

        if (!result) {
          throw new Error('Route not found');
        }

        assert(result.length >= 2, 'Route not found');
        assert(result[0].trackId === track1.trackId, 'result[0].trackId !== track1.trackId');

        // 経路の最初のtrackだけはreverseになることがあるので、修正
        if (!getNextTracks(result[0]).some((track) => track.trackId === result[1].trackId)) {
          result[0] = result[0].reverseTrack;
        }

        return result[0];
      })();

      platformTTItems.push({
        train: {
          trainId: diaTrain.trainId,
          trainName: diaTrain.trainName ?? 'No Name',
        },
        platform: {
          ...getTrackOfPlatform(tracks, diaTrain.diaTimes[diaTimeIndex].diaPlatform)!.track.platform!,
        } /* 暫定的、名称で一致させるとIDが合わなくなるので { ...diaTime.diaPlatform } */,
        departureTime: diaTime.departureTime,
        arrivalTime: diaTime.arrivalTime,
        track: track,
      });

      diaTimeIndex++;
    }
  }

  return platformTTItems;
}

function getTrackOfPlatform(tracks: HalfTrack[], platform: Platform): HalfTrack | undefined {
  return tracks.find(
    (t) =>
      t.track.platform?.platformId === platform.platformId ||
      /* TODO: 暫定的に名称で一致させる */ (t.track.platform?.station.stationName === platform.station.stationName &&
        t.track.platform.platformName === platform.platformName)
  );
}

function searchTrackPath(track1: HalfTrack, track2: HalfTrack): HalfTrack[] | undefined {
  // TODO: nextしか使っていない。=> 直したかな？
  const result = abstractSearch<HalfTrack>(
    track1,
    (track) => track.trackId,
    (track) =>
      track.trackId === track1.trackId
        ? getNextTracks(track).concat(getNextTracks(track.reverseTrack))
        : getNextTracks(track),
    (_, track) => getDistance(track._begin, track._end),
    (track) => track.trackId === track2.trackId || track.trackId == track2.reverseTrack.trackId
  )[0];

  return result;
}

function toSwitchTTItems(tracks: HalfTrack[], diaTrain: DiaTrain): SwitchTimetableItem[] {
  const diaTimes = diaTrain.diaTimes;
  if (diaTimes.length <= 1) {
    return [];
  }

  // 整合性チェック
  tracks.forEach((t) => {
    const prevSwitch_ = t._prevSwitch;
    const nextSwitch_ = t._nextSwitch;
    prevSwitch_.switchPatterns.forEach(([track1, track2]) =>
      assert(
        prevSwitch_.endTracks.filter((t) => t === track1).length === 1 &&
          prevSwitch_.beginTracks.filter((t) => t === track2).length === 1
      )
    );
    nextSwitch_.switchPatterns.forEach(([track1, track2]) =>
      assert(
        nextSwitch_.endTracks.filter((t) => t === track1).length === 1 &&
          nextSwitch_.beginTracks.filter((t) => t === track2).length === 1
      )
    );
  });

  const switchTTItems: SwitchTimetableItem[] = [];

  for (let diaTimeIndex = 0; diaTimeIndex < diaTimes.length - 1; diaTimeIndex++) {
    // TODO: これは、反対方向のトラックが入ることがある。 => searchTrackPath で吸収したので大丈夫なはず
    const track1 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex].diaPlatform);
    const track2 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex + 1].diaPlatform);
    if (!track1 || !track2) {
      throw new Error('Track not found');
    }

    // 最短経路を探索する
    const result = searchTrackPath(track1, track2);

    if (!result) {
      throw new Error('Route not found');
    }

    assert(result.length >= 2, 'Route not found');
    assert(result[0].trackId === track1.trackId, 'result[0].trackId !== track1.trackId');

    // 経路の最初のtrackだけはreverseになることがあるので、修正
    if (!getNextTracks(result[0]).some((track) => track.trackId === result[1].trackId)) {
      result[0] = result[0].reverseTrack;
    }

    // 通過するswitchを追加する
    for (let trackIndex = 0; trackIndex < result.length - 1; trackIndex++) {
      const currentSwitch = result[trackIndex]._nextSwitch;
      const nextTrack = result[trackIndex + 1];

      const possibleNextTracks = getNextTracks(result[trackIndex]);
      if (possibleNextTracks.length === 0) {
        // TODO: スイッチバック？
        throw new Error('Switchback is not supported');
      }

      const branchDirection = (() => {
        if (possibleNextTracks.length === 1) {
          // 進める候補が1つだけの時
          assert(possibleNextTracks[0].trackId === nextTrack.trackId);
          return 'Straight';
        }

        const straightTrack = getNextTrackOfStraightPattern(currentSwitch, result[trackIndex]);
        const branchTrack = getNextTrackOfBranchPattern(currentSwitch, result[trackIndex]);
        assert(straightTrack !== null);

        if (branchTrack != null && nextTrack.trackId === branchTrack.trackId) {
          return 'Branch';
        } else if (nextTrack.trackId === straightTrack.trackId) {
          return 'Straight';
        } else {
          throw new Error('Invalid track');
        }
      })();

      const prevDepartureTime = diaTimes[diaTimeIndex].departureTime;
      assert(prevDepartureTime !== null);

      switchTTItems.push({
        train: {
          trainId: diaTrain.trainId,
          trainName: diaTrain.trainName ?? 'No Name',
        },
        Switch: { ...currentSwitch },
        changeTime: prevDepartureTime,
        branchDirection: branchDirection,
      });
    }
  }

  return switchTTItems;
}

export function toDetailedTimetable(
  allTrackStations: Station[],
  timetable: OutlinedTimetable,
  tracks: HalfTrack[]
): DetailedTimetable {
  // 方向をどうするか。。。設置時？基本的にはダイヤ変換時に設定する。ホームトラック終端の上下 > （上下が同じなら）左右方向の区別とする。トラックが移動や回転された場合は再設定が必要になるが、その場合はどちらにしても再設定がいる。
  const platformTTItems = ([] as PlatformTimetableItem[]).concat(
    toPlatformTTItems(allTrackStations, tracks, timetable.inboundDiaTrains),
    toPlatformTTItems(allTrackStations, tracks, timetable.outboundDiaTrains)
  );

  // switchは、駅と駅の間の経路を探索し、通過したswitchを追加する
  // changeTimeをどうするか。。。 通過の列車の指定のほうがいい気がする。。？でも列車の指定はあるから、そんなに重複することはないか。1列車が駅に到着せずに一つのswitchを複数回通過することはないはず。
  const switchTTItems: SwitchTimetableItem[] = [];

  for (const diaTrain of timetable.inboundDiaTrains) {
    switchTTItems.push(...toSwitchTTItems(tracks, diaTrain));
  }
  for (const diaTrain of timetable.outboundDiaTrains) {
    switchTTItems.push(...toSwitchTTItems(tracks, diaTrain));
  }

  return {
    platformTTItems: platformTTItems,
    switchTTItems: switchTTItems,
  };
}

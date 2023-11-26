import { assert, nn } from '../../common';
import {
  DetailedTimetable,
  Operation,
  PlatformLike,
  PlatformTTItem,
  PlatformTimetable,
  PlatformTimetableMap,
  SwitchTTItem,
  SwitchTimetable,
  Track,
  Train,
} from '../../model';
import { OutlinedTimetableData } from '../../outlinedTimetableData';
import {
  abstractSearch,
  getDistance,
  getNextTrackOfBranchPattern,
  getNextTrackOfStraightPattern,
  getNextTracks,
} from '../../trackUtil';

function toPlatformTTItems(allPlatforms: PlatformLike[], tracks: Track[], trains: Train[]): PlatformTimetableMap {
  const allTrackPlatformIds = new Set<string>(allPlatforms.map((p) => p.platformId));

  // platformは基本的には時刻をそのまま転記すればよい
  const platformTTItems: PlatformTTItem[] = [];

  for (const train of trains) {
    let diaTimeIndex = 0;
    for (const diaTime of train.diaTimes) {
      if (!allTrackPlatformIds.has(diaTime.platform!.platformId)) {
        throw new Error('Platform not found in allTrackStations (' + diaTime.platform!.platformId + ')');
      }

      platformTTItems.push({
        trainId: train.trainId,
        diaTimeId: diaTime.diaTimeId,
        platformId: getTrackOfPlatform(tracks, train.diaTimes[diaTimeIndex].platform!)!.track.platform!.platformId,
        /* 暫定的、名称で一致させるとIDが合わなくなるので { ...diaTime.diaPlatform } */
        departureTime: diaTime.departureTime,
        arrivalTime: diaTime.arrivalTime,
        isInService: diaTime.isInService,
        isPassing: diaTime.isPassing,
      });

      diaTimeIndex++;
    }
  }

  const platformTimetableMapRaw = new Map<string, PlatformTTItem[]>();
  for (const platformId of allTrackPlatformIds.keys()) {
    platformTimetableMapRaw.set(platformId, []);
  }
  for (const ttItem of platformTTItems) {
    const items = platformTimetableMapRaw.get(ttItem.platformId);
    assert(items != null);
    items.push(ttItem);
  }
  for (const platformId of allTrackPlatformIds.keys()) {
    nn(platformTimetableMapRaw.get(platformId)).sort(
      (a, b) => nn(a.departureTime ?? a.arrivalTime) - nn(b.departureTime ?? b.arrivalTime)
    );
  }

  return new Map(
    [...platformTimetableMapRaw.entries()].map(([platformId, items]) => [platformId, new PlatformTimetable(items)])
  );
}

function getTrackOfPlatform(tracks: Track[], platform: PlatformLike): Track | undefined {
  return tracks.find(
    (t) =>
      t.track.platform?.platformId === platform.platformId ||
      /* TODO: 暫定的に名称で一致させる */ (t.track.platform?.station.stationName === platform.station.stationName &&
        t.track.platform.platformName === platform.platformName)
  );
}

export function searchTrackPath(track1: Track, track2: Track): Track[] | undefined {
  // TODO: nextしか使っていない。=> 直したかな？
  const result = abstractSearch<Track>(
    track1,
    (track) => track.trackId,
    (track) =>
      track.trackId === track1.trackId
        ? getNextTracks(track).concat(getNextTracks(track.reverseTrack))
        : getNextTracks(track),
    (_, track) => getDistance(track.begin, track.end),
    (track) => track.trackId === track2.trackId || track.trackId == track2.reverseTrack.trackId
  )[0];

  return result;
}

function toSwitchTTItems(tracks: Track[], train: Train): SwitchTTItem[] {
  const diaTimes = train.diaTimes;
  if (diaTimes.length <= 1) {
    return [];
  }

  // 整合性チェック
  tracks.forEach((t) => {
    const prevSwitch_ = t.prevSwitch;
    const nextSwitch_ = t.nextSwitch;
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

  const switchTTItems: SwitchTTItem[] = [];
  const switchIds = new Map<string, null>();

  for (let diaTimeIndex = 0; diaTimeIndex < diaTimes.length - 1; diaTimeIndex++) {
    // TODO: これは、反対方向のトラックが入ることがある。 => searchTrackPath で吸収したので大丈夫なはず
    const track1 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex].platform!);
    const track2 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex + 1].platform!);
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
      const currentSwitch = result[trackIndex].nextSwitch;
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

      // const prevDepartureTime = diaTimes[diaTimeIndex].departureTime;
      // assert(prevDepartureTime !== null);

      switchTTItems.push({
        trainId: train.trainId,
        switchId: currentSwitch.switchId,
        // changeTime: prevDepartureTime,
        branchDirection: branchDirection,
      });

      switchIds.set(currentSwitch.switchId, null);
    }
  }

  return switchTTItems;
}

function isPlatformsIsNotNull(timetable: OutlinedTimetableData) {
  const nullPlatforms = timetable
    .getTrains()
    .filter((t) => t.diaTimes.some((d) => (d.arrivalTime != null || d.departureTime != null) && d.platform === null));

  if (nullPlatforms.length > 0) {
    alert('番線が設定されていない箇所があります');
    return false;
  }
  return true;
}

function toTimetableMap(switchTTItems: SwitchTTItem[]) {
  const switchTimetableMapRaw = new Map<string, SwitchTTItem[]>();
  for (const switchId of switchTTItems.map((item) => item.switchId)) {
    switchTimetableMapRaw.set(switchId, []);
  }
  for (const ttItem of switchTTItems) {
    const items = switchTimetableMapRaw.get(ttItem.switchId);
    assert(items != null);
    items.push(ttItem);
  }

  return new Map(
    [...switchTimetableMapRaw.entries()].map(([switchId, items]) => [switchId, new SwitchTimetable(switchId, items)])
  );
}

export function toDetailedTimetable(
  allPlatforms: PlatformLike[],
  timetableData: OutlinedTimetableData,
  tracks: Track[]
): DetailedTimetable | null {
  if (!isPlatformsIsNotNull(timetableData)) {
    return null;
  }

  // TODO: 経路的に駅を経由しないといけないのに時刻が入っていないのはおかしいのでエラーにすべきなはず。。でも処理がややこしい。。。
  // というかまずは単に時刻が入っていないのをエラーにすべき気がする。。。

  // 方向をどうするか。。。設置時？基本的にはダイヤ変換時に設定する。ホームトラック終端の上下 > （上下が同じなら）左右方向の区別とする。トラックが移動や回転された場合は再設定が必要になるが、その場合はどちらにしても再設定がいる。
  const platformTimetableMap = toPlatformTTItems(allPlatforms, tracks, timetableData.getTrains());

  // switchは、駅と駅の間の経路を探索し、通過したswitchを追加する
  // changeTimeをどうするか。。。 通過の列車の指定のほうがいい気がする。。？でも列車の指定はあるから、そんなに重複することはないか。1列車が駅に到着せずに一つのswitchを複数回通過することはないはず。
  const switchTTItems: SwitchTTItem[] = [];

  for (const train of timetableData.getTrains()) {
    switchTTItems.push(...toSwitchTTItems(tracks, train));
  }

  const switchTimetableMap = toTimetableMap(switchTTItems);

  const operations = timetableData
    .getTimetables()
    .map((timetable) => timetable.operations)
    .flat();

  return {
    platformTimetableMap,
    switchTimetableMap,
    operations,
  };
}

export function generateOperationCode(operations: Operation[]) {
  const operationCodes = operations.map((o) => o.operationCode);
  for (let i = 1; i < 1000; i++) {
    const operationCode = 'O' + i.toString().padStart(3, '0');
    if (!operationCodes.includes(operationCode)) {
      return operationCode;
    }
  }
  return Math.random().toString().replace('.', '');
}

import { assert } from '../../common';
import { HalfTrack, Platform, Station } from '../../model';
import { abstractSearch, getDistance, getNextTracks } from '../../trackUtil';
import { DiaTrain, Timetable as OutlinedTimetable } from './../timetable-editor/model';
import { getNextTrackOfBranchPattern, getNextTrackOfStraightPattern } from './trainMove2';
import { Timetable as DetailedTimetable, PlatformTimetableItem, SwitchTimetableItem } from './uiEditorModel';

// export interface PlatformTimetableItem {
//   train: Train;
//   platform: Platform;
//   departureTime: number;
// }

// export interface SwitchTimetableItem {
//   train: Train;
//   Switch: Switch;
//   changeTime: number;
//   branchDirection: BranchDirection;
// }

// export interface DetailedTimetable {
//   platformTTItems: PlatformTimetableItem[];
//   switchTTItems: SwitchTimetableItem[];
// }

// export interface DiaTime {
//   diaTimeId: string;
//   arrivalTime: number | null;
//   departureTime: number | null;
//   isPassing: boolean;
//   diaStation: Station;
//   diaPlatform: Platform;
// }

// export interface TrainType {
//   trainTypeId: string;
//   trainTypeName: string;
//   trainTypeColor: string;
// }

// export interface DiaTrain {
//   diaTrainId: string;
//   trainName?: string;
//   trainType?: TrainType;
//   diaTimes: DiaTime[];
// }

// export type TimetableDirection = 'Outbound' | 'Inbound';

// // Timetableを含む全てのデータ
// export interface TimetableData {
//   timetable: Timetable;
// }

// export interface Timetable {
//   inboundDiaTrains: DiaTrain[];
//   outboundDiaTrains: DiaTrain[];
//   stations: Station[];
// }

// 駅名のみ変換する
// function toOutlinedTimetableStations(stations: Station[]): OutlinedTimetable {
//   return {
//     stations: stations,
//     inboundDiaTrains: [],
//     outboundDiaTrains: [],
//   };
// }

// diaStationId: string;
// diaStationName: string;
// diaPlatforms: DiaPlatform[];
// defaultOutboundDiaPlatformId: string;
// defaultInboundDiaPlatformId: string;

function toPlatformTTItems(allTrackStations: Station[], diaTrains: DiaTrain[]): PlatformTimetableItem[] {
  const allTrackPlatformIds = new Set<string>(allTrackStations.map((s) => s.platforms.map((p) => p.platformId)).flat());

  // platformは基本的には時刻をそのまま転記すればよい
  const platformTTItems: PlatformTimetableItem[] = [];

  for (const diaTrain of diaTrains) {
    let diaTimeIndex = 0;
    for (const diaTime of diaTrain.diaTimes) {
      if (!allTrackPlatformIds.has(diaTime.diaPlatform.platformId)) {
        throw new Error('Platform not found in allTrackStations (' + diaTime.diaPlatform.platformId + ')');
      }

      platformTTItems.push({
        train: {
          trainId: diaTrain.diaTrainId,
          trainName: diaTrain.trainName ?? 'No Name',
        },
        platform: { ...diaTime.diaPlatform },
        departureTime: diaTime.departureTime,
        arrivalTime: diaTime.arrivalTime,
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
      /* TODO: 暫定。 */ (t.track.platform?.station.stationName === platform.station.stationName &&
        t.track.platform.platformName === platform.platformName)
  );
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
    // TODO: これは、反対方向のトラックが入ることがある。
    const track1 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex].diaPlatform);
    const track2 = getTrackOfPlatform(tracks, diaTimes[diaTimeIndex + 1].diaPlatform);
    if (!track1 || !track2) {
      throw new Error('Track not found');
    }

    // 最短経路を探索する
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
          trainId: diaTrain.diaTrainId,
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
    toPlatformTTItems(allTrackStations, timetable.inboundDiaTrains),
    toPlatformTTItems(allTrackStations, timetable.outboundDiaTrains)
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

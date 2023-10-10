import { StateUpdater, useState } from 'preact/hooks';
import { JSON_decycle } from '../../cycle';
import { AppStates, RailwayLine } from '../../mapEditorModel';
import {
  AppClipboard,
  OutlinedTimetable,
  SettingData,
  Station,
  OutlinedTimetableData,
  TimetableDirection,
  Train,
  TrainType,
  Track,
} from '../../model';
import { createAgentManager } from '../track-editor/agentManager';
import { createTrainMove } from '../track-editor/trainMoveBase';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
import { StationDetailComponent, StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { clearTimetable, deleteTrains, getInitialTimetable, getTrain, reverseTimetableDirection } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';
import { DiagramOperationComponent } from './diagram-operation-component';
import { importOutdiaFile } from '../../file';

export function TrainListRowHeaderComponent({ diaStations }: { diaStations: Station[] }) {
  return (
    <div>
      {diaStations.map((diaStation) => (
        <div style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', width: '32px' }}>
          <div style={{ height: 24 + 'px' }}>着</div>
          <div style={{ height: 24 + 'px' }}>番線</div>
          <div style={{ height: 24 + 'px' }}>発</div>
        </div>
      ))}
    </div>
  );
}

export function TimetableEditorTableComponent({
  diaStations,
  setDiaStations,
  trains,
  otherDirectionTrains,
  setTrains,
  timetableDirection,
  trainTypes,
  setSettingData,
  clipboard,
  setClipboard,
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  trains: Train[];
  otherDirectionTrains: Train[];
  setTrains: (trains: Train[]) => void;
  timetableDirection: 'Inbound' | 'Outbound';
  trainTypes: TrainType[];
  setSettingData: (settingData: SettingData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '24px' }}>列車番号</div>
        <div style={{ height: '24px' }}>列車種別</div>
        <div style={{ height: '24px' }}>始発駅作業</div>
        <div style={{ height: '24px' }}>終着駅作業</div>
        <StationListComponent
          {...{ diaStations, trains, otherDirectionTrains, setDiaStations, timetableDirection, setSettingData }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <TrainListRowHeaderComponent diaStations={diaStations} />
      </div>
      <TrainListComponent
        {...{
          diaStations: diaStations,
          trains: trains,
          setTrains: (trains) => {
            setTrains([...trains]);
          },
          timetableDirection: timetableDirection,
          trainTypes,
          clipboard,
          setClipboard,
        }}
      />
    </div>
  );
}

export function TimetableEditorComponent({
  outlinedTimetableData,
  timetable,
  railwayLine,
  tracks,
  setOutlinedTimetableData,
  setToast,
  update,
}: {
  outlinedTimetableData : OutlinedTimetableData,
  timetable: OutlinedTimetable,
  railwayLine: RailwayLine | null,
  tracks : Track[],
  setOutlinedTimetableData: StateUpdater<OutlinedTimetableData>,
  setToast: (message: string) => void,
  update: () => void
}) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrains: [],
  });
  const [settingData, setSettingData] = useState<SettingData | null>(null);

  function mergeTimetable(diagram: [OutlinedTimetable, Train[]]) {
    const [outlinedTimetable, trains] = diagram;
    
    // 存在しないstationがある
    if (outlinedTimetable.stations.some(station => !timetable.stations.some(station2 => station.stationId === station2.stationId))) {
      return {
        error: '存在しない駅があります'
      }
    }

    timetable.inboundTrainIds = outlinedTimetable.inboundTrainIds;
    timetable.outboundTrainIds = outlinedTimetable.outboundTrainIds;
    timetable.operations = outlinedTimetable.operations;
    timetable.trainTypes = outlinedTimetable.trainTypes;
    outlinedTimetableData.trains.push(...trains); // なんか重複するのもできそうな気がするが... とりあえず問題になったら考え

    return true;
  }

  const inboundTrains = timetable.inboundTrainIds.map(trainId => getTrain(outlinedTimetableData, trainId));
  const outboundTrains = timetable.outboundTrainIds.map(trainId => getTrain(outlinedTimetableData, trainId));

  const setDiaStations = (stations: Station[]) => {
    timetable.stations = stations;
    update();
  };
  
  const setTrainTypes = (trainTypes: TrainType[]) => {
    timetable.trainTypes = trainTypes;
    update();
  }

  const setTrains = (trains: Train[]) => {
    // 削除した分の処理
    const toDeletedTrainIds = timetableDirection === 'Inbound' ?
      timetable.inboundTrainIds.filter(trainId => !trains.some(train => train.trainId === trainId)) :
      timetable.outboundTrainIds.filter(trainId => !trains.some(train => train.trainId === trainId));
    deleteTrains(outlinedTimetableData, toDeletedTrainIds);

    // 追加した分の処理
    const toAddedTrains = trains.filter(train => !outlinedTimetableData.trains.some(train2 => train2.trainId === train.trainId));
    outlinedTimetableData.trains.push(...toAddedTrains);

    if (timetableDirection === 'Inbound') {
      timetable.inboundTrainIds = trains.map(train => train.trainId);
    } else {
      timetable.outboundTrainIds = trains.map(train => train.trainId);
    }
    
    update();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
        <div
          style={{
            display: 'inline-block',
            borderStyle: 'solid',
            borderWidth: '1px',
            padding: '2px',
          }}
        >
          OudiaSecondV2 Import
          <input
            type='file'
            id='file-selector'
            accept='.oud2'
            onChange={async (event) => {
              const diagram = await importOutdiaFile(event);
              if (diagram != null) {
                clearTimetable(outlinedTimetableData, timetable);
                const result = mergeTimetable(diagram);
                if (result !== true) {
                  setToast(result.error);
                }
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            const [newTimetable, newTrains] = reverseTimetableDirection(outlinedTimetableData, timetable);
            
            clearTimetable(outlinedTimetableData, timetable);
            setOutlinedTimetableData({
              timetables: outlinedTimetableData.timetables.concat([newTimetable]),
              trains: outlinedTimetableData.trains.concat(newTrains)
            })

            // setOutlinedTimetableData(timetableData => {
            //   clearTimetable(timetableData, timetable);
            //   return ({
            //     timetables: timetableData.timetables.concat([newTimetable]),
            //     trains: timetableData.trains.concat(newTrains)
            //   })
            // });
          }}
        >
          上り下りを反転
        </button>
        <button
          onClick={() => {
            if (!confirm('全てクリアしますか？')) {
              return;
            }

            const [newTimetable, newTrains] = getInitialTimetable(railwayLine);
            clearTimetable(outlinedTimetableData, timetable);
            setOutlinedTimetableData({
              timetables: outlinedTimetableData.timetables.concat([newTimetable]),
              trains: outlinedTimetableData.trains.concat(newTrains)
            })

            // setOutlinedTimetableData(timetableData => {
            //   clearTimetable(timetableData, timetable);
            //   return ({
            //     timetables: timetableData.timetables.concat([newTimetable]),
            //     trains: timetableData.trains.concat(newTrains)
            //   })
            // });
          }}
        >
          初期化
        </button>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: '1 1 auto' }}>
          <TabComponent
            onTabChange={(tabId) => {
              setTimetableDirection(tabId === 1 ? 'Inbound' : 'Outbound');
            }}
            tabs={[
              {
                tabId: 1,
                tabText: '上り',
                component: () => (
                  <TimetableEditorTableComponent
                    {...{
                      diaStations: timetable.stations,
                      setDiaStations: setDiaStations,
                      trains: inboundTrains,
                      otherDirectionTrains: outboundTrains,
                      setTrains: setTrains,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
                    }}
                  />
                ),
              },
              {
                tabId: 2,
                tabText: '下り',
                component: () => (
                  <TimetableEditorTableComponent
                    {...{
                      diaStations: reverseArray(timetable.stations),
                      setDiaStations: (diaStations) => setDiaStations(reverseArray(diaStations)),
                      trains: outboundTrains,
                      otherDirectionTrains: inboundTrains,
                      setTrains: setTrains,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
                    }}
                  />
                ),
              },
              {
                tabId: 3,
                tabText: '種別の設定',
                component: () => (
                  <TrainTypeSettingComponent
                    trainTypes={timetable.trainTypes}
                    setTrainTypes={setTrainTypes}
                  />
                ),
              },
              {
                tabId: 4,
                tabText: '駅時刻表',
                component: () => (
                  <StationTimetablePageComponent
                    diaStations={timetable.stations}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                  />
                ),
              },
              {
                tabId: 5,
                tabText: 'ダイヤグラム',
                component: () => (
                  <DiagramPageComponent
                    diaStations={timetable.stations}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                    operations={timetable.operations}
                    setUpdate={() => {
                      update
                    }}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                  />
                ),
              },
              {
                tabId: 6,
                tabText: '運用表',
                component: () => (
                  <DiagramOperationComponent
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                    operations={timetable.operations}
                    setUpdate={() => {
                      update();
                    }}
                  />
                )
              }
            ]}
          />
        </div>
        {settingData == null ? (
          <></>
        ) : (
          <SettingColumnComponent setSettingData={setSettingData} width='250px'>
            {settingData.settingType === 'StationSetting' ? (
              <StationDetailComponent
                diaStation={settingData.station}
                setDiaStation={(diaStation) => {
                  setDiaStations(
                    timetable.stations.map((diaStation_) =>
                      diaStation_.stationId === diaStation.stationId ? diaStation : diaStation_
                    )
                  );
                }}
              />
            ) : (
              <></>
            )}
          </SettingColumnComponent>
        )}
      </div>
    </div>
  );
}

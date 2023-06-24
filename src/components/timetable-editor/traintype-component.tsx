import { useState } from 'preact/hooks';
import { generateId } from '../../model';
import { SettingColumnComponent } from './common-component';
import { TrainType } from './model';

interface TrainTypeSettingData {
  settingType: 'TrainTypeSetting';
  trainType: TrainType;
}

// 種別の編集
function TrainTypeDetailComponent({
  trainType,
  setTrainType,
}: {
  trainType: TrainType;
  setTrainType: (trainType: TrainType) => void;
}) {
  return (
    <div>
      <div>
        <div>種別名</div>
        <div>
          <input
            value={trainType.trainTypeName}
            onChange={(e) => {
              if ((e.target as HTMLInputElement)?.value != null) {
                setTrainType({ ...trainType, trainTypeName: (e.target as HTMLInputElement).value });
              }
            }}
          />
        </div>
      </div>
      <div>
        <div>種別色</div>
        <div>
          <input
            type='color'
            value={trainType.trainTypeColor}
            onChange={(e) => {
              if ((e.target as HTMLInputElement)?.value != null) {
                setTrainType({ ...trainType, trainTypeColor: (e.target as HTMLInputElement).value });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function TrainTypeSettingComponent({
  trainTypes,
  setTrainTypes,
}: {
  trainTypes: TrainType[];
  setTrainTypes: (trainTypes: TrainType[]) => void;
}) {
  const [settingData, setSettingData] = useState<TrainTypeSettingData | null>(null);

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: '1 1 auto' }}>
        <div style={{ width: '200px' }}>
          {trainTypes.map((trainType) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div
                style={{ width: '140px' }}
                onClick={() => {
                  setSettingData({ settingType: 'TrainTypeSetting', trainType: trainType });
                }}
                // マウスホバー時に背景色を灰色にする
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#dddddd';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '';
                }}
              >
                {trainType.trainTypeName}
              </div>
              <div>
                <button
                  onClick={() => {
                    setTrainTypes(trainTypes.filter((t) => t.trainTypeId !== trainType.trainTypeId));
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <button
            onClick={() => {
              setTrainTypes([
                ...trainTypes,
                { trainTypeId: generateId(), trainTypeName: '-', trainTypeColor: '#000000' },
              ]);
            }}
          >
            種別を追加
          </button>
        </div>
      </div>
      {settingData == null ? (
        <></>
      ) : (
        <SettingColumnComponent setSettingData={setSettingData}>
          {settingData != null && settingData.settingType === 'TrainTypeSetting' ? (
            <TrainTypeDetailComponent
              trainType={settingData.trainType}
              setTrainType={(trainType) => {
                setTrainTypes(trainTypes.map((t) => (t.trainTypeId === trainType.trainTypeId ? trainType : t)));
              }}
            />
          ) : (
            <></>
          )}
        </SettingColumnComponent>
      )}
    </div>
  );
}

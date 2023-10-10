import { useState } from 'preact/hooks';
import { SettingColumnComponent } from '../timetable-editor/common-component';

export function ListSettingCommonComponent<T>({
  datas,
  setDatas,
  selectData,
  getSettingComponent,
  getDisplayName,
  excludeFromDatas,
  getNewData,
  settingColumnWidth,
}: {
  datas: T[];
  setDatas: (datas: T[]) => void;
  selectData: (data: T) => void;
  getSettingComponent: (data: T) => any /* JSX.Element */;
  getDisplayName: (data: T) => string;
  excludeFromDatas: (datas: T[], data: T) => T[];
  getNewData: (() => T) | null;
  settingColumnWidth?: string;
}) {
  const [settingData, setSettingData] = useState<T | null>(null);

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: '1 1 auto' }}>
        <div style={{ width: '200px' }}>
          {datas.map((data) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div
                style={{ width: '140px', backgroundColor: settingData === data ? '#ddd' : '', cursor: 'pointer' }}
                onClick={() => {
                  selectData(data);
                  setSettingData(data);
                }}
              >
                {getDisplayName(data)}
              </div>
              <div>
                <button
                  onClick={() => {
                    setDatas(excludeFromDatas(datas, data));
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
        <div>
          {getNewData !== null ? (
            <button
              onClick={() => {
                const newData = getNewData();
                setDatas([...datas, newData]);
              }}
            >
              追加
            </button>
          ) : (
            <></>
          )}
        </div>
      </div>
      {settingData == null ? (
        <></>
      ) : (
        <SettingColumnComponent setSettingData={setSettingData} width={settingColumnWidth ?? '250px'}>
          {settingData != null ? getSettingComponent(settingData) : <></>}
        </SettingColumnComponent>
      )}
    </div>
  );
}

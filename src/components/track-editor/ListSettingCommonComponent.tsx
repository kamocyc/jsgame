import React, { useState } from 'react';
import { SettingColumnComponent } from '../timetable-editor/common-component';

export function ListSettingCommonComponent<T>({
  datas,
  defaultData,
  setDatas,
  selectData,
  getSettingComponent,
  getDisplayName,
  getKey,
  excludeFromDatas,
  getNewData,
  settingColumnWidth,
}: {
  datas: T[];
  defaultData?: T | undefined;
  setDatas: (datas: T[]) => void;
  selectData: (data: T) => void;
  getSettingComponent: (data: T) => React.ReactNode;
  getDisplayName: (data: T) => string;
  getKey: (data: T) => string;
  excludeFromDatas: ((datas: T[], data: T) => T[]) | null;
  getNewData: (() => T) | null;
  settingColumnWidth?: string;
}) {
  const [settingData, setSettingData] = useState<T | null>(defaultData ?? null);

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: '1 1 auto' }}>
        <div style={{ width: '200px' }}>
          {datas.map((data) => (
            <div key={getKey(data)} style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                {excludeFromDatas !== null ? (
                  <button
                    onClick={() => {
                      const result = excludeFromDatas(datas, data);

                      setDatas(result);
                    }}
                  >
                    削除
                  </button>
                ) : (
                  <></>
                )}
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

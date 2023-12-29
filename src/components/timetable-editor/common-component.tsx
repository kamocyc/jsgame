import { RefObject, useEffect, useRef, useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { StateUpdater, parseTime, toStringFromSeconds } from '../../common';
import { ContextData, StationLike, Train, getDefaultTime } from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';
import './timetable-editor.css';

export function getStationMap(stations: DeepReadonly<StationLike[]>): DeepReadonly<Map<string, StationLike>> {
  return new Map(stations.map((station) => [station.stationId, station]));
}

// このコールバックでsetXXXを実行すると当然ながらコンポーネントが再描画される。パフォーマンスやよきせぬ動作になるので注意。
export function useOnClickOutside(ref: RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && (event.target == null || !ref.current.contains(event.target as Node))) {
        handler();
      }
      // } else {
      //   console.log('hit');
      // }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);
}

export function EditableTextComponent({
  value,
  onChange,
  height,
  width,
}: {
  value: string;
  onChange: (value: string) => boolean;
  height: number;
  width: number | null;
}) {
  const [isEditing, setIsEditing] = useState(false);

  // コントロール外をクリックしたときに編集を終了する
  const ref = useRef<HTMLInputElement>(null);
  useOnClickOutside(ref, () => {
    if (isEditing) setIsEditing(false);
  });

  // 編集開始時にフォーカスする
  useEffect(() => {
    if (isEditing) {
      // 全選択する
      ref.current?.focus();
      ref.current?.setSelectionRange(0, ref.current?.value.length);
    }
  }, [isEditing]);

  return (
    <div
      style={{
        height: height + 'px',
        width: width != null ? width + 'px' : '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <input
        ref={ref}
        className={isEditing ? 'input-common' : 'text-common'}
        style={{ width: width != null ? width - 6 + 'px' : '100%', paddingRight: '2px' }}
        value={value}
        onChange={(e) => {
          const stringValue = (e.target as HTMLInputElement).value.trim();
          if (!onChange(stringValue)) {
            (e.target as HTMLInputElement).value = value;
          }
        }}
        onFocus={() => {
          setIsEditing(true);
        }}
        onBlur={() => {
          setIsEditing(false);
        }}
      />
    </div>
  );
}

export function TimeInputComponent({ time, setTime }: { time: number | null; setTime: (time: number | null) => void }) {
  const toStringFromTime = (time: number | null) => {
    return time == null ? '・・' : toStringFromSeconds(time);
  };
  const initialValue = toStringFromTime(time);
  const [inputValue, setInputValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  // コントロール外をクリックしたときに編集を終了する
  const ref = useRef<HTMLInputElement>(null);
  useOnClickOutside(ref, () => {
    if (isEditing) setIsEditing(false);
  });

  // 編集開始時にフォーカスする
  useEffect(() => {
    if (isEditing) {
      // 全選択する
      ref.current?.focus();
      ref.current?.setSelectionRange(0, ref.current?.value.length);
    }
  }, [isEditing]);

  function getNextTime(time: number | null) {
    if (time === null) {
      return getDefaultTime();
    } else {
      return (time + 60) % (24 * 60 * 60);
    }
  }
  function getPrevTime(time: number | null) {
    if (time === null) {
      return getDefaultTime();
    } else {
      return (time - 60 + 24 * 60 * 60) % (24 * 60 * 60);
    }
  }

  const height = 24;
  const width = 44;
  const onChange = (value: string) => {
    if (value === '') {
      setTime(null);
      return true;
    }

    const newTime = parseTime(value);
    if (newTime !== undefined) {
      setTime(newTime);
      return true;
    }
    return false;
  };

  return (
    <div
      style={{
        height: height + 'px',
        width: width != null ? width + 'px' : '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <input
        ref={ref}
        className={isEditing ? 'input-common' : 'text-common'}
        style={{ width: width != null ? width - 6 + 'px' : '100%', paddingRight: '2px' }}
        value={inputValue}
        onChange={(e) => {
          setInputValue((e.target as HTMLInputElement).value);
        }}
        onFocus={() => {
          setIsEditing(true);
        }}
        onBlur={(e) => {
          const stringValue = (e.target as HTMLInputElement).value.trim();
          if (onChange(stringValue)) {
            setInputValue(toStringFromTime(parseTime(stringValue) ?? null));
          } else {
            setInputValue(initialValue);
          }

          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          // 上キーが押されたら数字を増やす
          if (e.key === 'ArrowUp') {
            const newTime = getNextTime(time);
            setTime(newTime);
            setInputValue(toStringFromSeconds(newTime));
          }
          if (e.key === 'ArrowDown') {
            const newTime = getPrevTime(time);
            setTime(newTime);
            setInputValue(toStringFromSeconds(newTime));
          }
        }}
      />
    </div>
  );
}

function ContextMenuItemComponent({ label, onClick }: { label: string; onClick: () => void }) {
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      onMouseEnter={() => {
        setIsHover(true);
      }}
      onMouseLeave={() => {
        setIsHover(false);
      }}
      style={{ padding: '1.5px 3px', backgroundColor: isHover ? 'lightgray' : 'white' }}
      onClick={onClick}
    >
      {label}
    </div>
  );
}

export function ContextMenuComponent({
  contextData,
  setContextData,
  menuItems,
}: {
  contextData: ContextData;
  setContextData: StateUpdater<ContextData>;
  menuItems: { label: string; menuItemId: string; onClick: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => {
    setContextData((contextData) => {
      return contextData.visible ? { ...contextData, visible: false } : contextData;
    });
  });

  return (
    <div
      ref={ref}
      className='context-menu'
      style={{
        display: contextData.visible ? 'block' : 'none',
        left: contextData.posX + 'px',
        top: contextData.posY + 'px',
      }}
    >
      {menuItems.map((menuItem) => (
        <ContextMenuItemComponent key={menuItem.menuItemId} label={menuItem.label} onClick={menuItem.onClick} />
      ))}
    </div>
  );
}

export function SettingColumnComponent({
  children,
  setSettingData,
  width,
}: {
  children: React.ReactNode;
  setSettingData: (settingData: null) => void;
  width?: string;
}) {
  return (
    <div style={{ width: width ?? '250px', borderLeft: '2px solid #000', padding: '5px' }}>
      <div>
        {/* 右上に閉じるボタンを設置 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setSettingData(null);
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}

export function reverseArray<T>(array: ReadonlyArray<T>) {
  return [...array].reverse();
}

export interface Tab {
  tabId: number;
  tabText: string;
  component: () => any /* JSX.Element */;
}

export function TabComponent({
  tabs,
  onTabChange,
  defaultTabIndex = 0,
}: {
  tabs: [Tab, ...Tab[]];
  onTabChange: (tabId: number) => void;
  defaultTabIndex?: number;
}) {
  const [selectedTabId, setSelectedTabId] = useState<number>(tabs[defaultTabIndex].tabId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {tabs.map((tab) => (
          <div
            key={tab.tabId}
            style={{
              borderStyle: 'solid',
              borderWidth: '1px',
              backgroundColor: tab.tabId === selectedTabId ? 'white' : 'lightgray',
              borderBottom: 'none',
              height: '28px',
            }}
            onClick={() => {
              setSelectedTabId(tab.tabId);
              onTabChange(tab.tabId);
            }}
          >
            <div
              style={
                tab.tabId === selectedTabId
                  ? { padding: '4px', height: '22px', backgroundColor: '#fff', zIndex: '1', position: 'relative' }
                  : { padding: '4px' }
              }
            >
              {tab.tabText}
            </div>
          </div>
        ))}
      </div>
      <div style={{ border: '2px', borderStyle: 'solid', borderColor: '#ccc', padding: '5px' }}>
        {tabs.find((tab) => tab.tabId === selectedTabId)?.component()}
      </div>
    </div>
  );
}

export interface SplitView {
  splitViewId: number;
  component: () => any /* JSX.Element */;
}

export function SplitViewComponent({ splitViews }: { splitViews: SplitView[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {splitViews.map((splitView) => (
        <div key={splitView.splitViewId} style={{ borderStyle: 'solid', borderWidth: '5px', borderBottom: 'none' }}>
          {splitView.component()}
        </div>
      ))}
    </div>
  );
}

export type SetTimetable = (
  f: (
    draftTimetable: OutlinedTimetable,
    trainData: { trains: Train[]; otherDirectionTrains: Train[] },
    stationMap: Map<string, DeepReadonly<StationLike>> | null
  ) => void
) => void;

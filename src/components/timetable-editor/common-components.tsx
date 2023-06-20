import { ComponentChild } from 'preact';
import { Ref, useEffect, useRef, useState } from 'preact/hooks';
import { parseTime, showGlobalTime } from '../../timetableEditor';
import './timetable-editor.css';
import { ContextData } from './timetable-model';

/**
 * Hook that alerts clicks outside of the passed ref
 */
export function useOnClickOutside(ref: Ref<HTMLElement>, handler: () => void) {
  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && (event.target == null || !ref.current.contains(event.target as Node))) {
        handler();
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
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
  useOnClickOutside(ref, () => setIsEditing(false));

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
  return (
    <EditableTextComponent
      value={time == null ? '・・' : showGlobalTime(time)}
      onChange={(value) => {
        if (value === '') {
          setTime(null);
          return true;
        }

        const newTime = parseTime(value);
        if (newTime) {
          setTime(newTime);
          return true;
        }
        return false;
      }}
      height={24}
      width={44}
    />
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
  setContextData: (contextData: ContextData) => void;
  menuItems: { label: string; onClick: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setContextData({ ...contextData, visible: false }));

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
        <ContextMenuItemComponent label={menuItem.label} onClick={menuItem.onClick} />
      ))}
    </div>
  );
}

export function SettingColumnComponent({
  children,
  setSettingData,
}: {
  children: ComponentChild;
  setSettingData: (settingData: null) => void;
}) {
  return (
    <div style={{ width: '250px', borderLeft: '2px solid #000', padding: '5px' }}>
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

export function reverseArray<T>(array: T[]) {
  return [...array].reverse();
}

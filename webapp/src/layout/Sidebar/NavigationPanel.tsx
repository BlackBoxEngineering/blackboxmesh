import type { RadioControl } from '../sidebarTypes';
import type { ActiveView } from '../../types/view';
import { NavButton } from './NavButton';

export function NavigationPanel({
  activeView,
  radio,
  onViewChange,
}: {
  activeView: ActiveView;
  radio: RadioControl;
  onViewChange: (view: ActiveView) => void;
}) {
  return (
    <div className="p-4 border-b border-gray-700 space-y-2">
      <NavButton activeView={activeView} view="network" label="Network" onViewChange={onViewChange}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      </NavButton>
      <NavButton activeView={activeView} view="config" label="Configuration" onViewChange={onViewChange}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </NavButton>
      <NavButton activeView={activeView} view="map" label="Map" onViewChange={onViewChange}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </NavButton>
      <NavButton
        activeView={activeView}
        view="radio"
        label="Radio"
        onViewChange={onViewChange}
        status={radio.status === 'connected' && <span className="ml-auto text-[10px] text-green-300">{radio.nodeId ?? 'on'}</span>}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12a7 7 0 0114 0M2 12a10 10 0 0120 0M8.5 12a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z" />
        </svg>
      </NavButton>
    </div>
  );
}

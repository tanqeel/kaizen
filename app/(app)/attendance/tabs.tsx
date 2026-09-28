'use client';

import { useState } from 'react';
import { Tabs, TabPanel, type TabItem } from '@/components/ui';
import type { IconName } from '@/components/icons';
import { GateTab } from './gate-tab';
import { PeriodTab } from './period-tab';
import { ConflictsTab } from './conflicts-tab';

export interface AttendanceSection {
  id: string;
  label: string;
}

const ALL_TABS: Array<TabItem & { id: 'gate' | 'period' | 'conflicts'; perm: 'gate' | 'period' | 'conflicts'; icon: IconName }> = [
  { id: 'gate', label: 'Gate Check-In', icon: 'fingerprint', perm: 'gate' },
  { id: 'period', label: 'Period Register', icon: 'clipboard-check', perm: 'period' },
  { id: 'conflicts', label: 'Conflicts', icon: 'alert-triangle', perm: 'conflicts' },
];

export function AttendanceTabs({
  canGate,
  canPeriod,
  canConflicts,
  sections,
  defaultTab,
}: {
  canGate: boolean;
  canPeriod: boolean;
  canConflicts: boolean;
  sections: AttendanceSection[];
  defaultTab: string;
}) {
  const visible = ALL_TABS.filter(
    (t) =>
      (t.perm === 'gate' && canGate) ||
      (t.perm === 'period' && canPeriod) ||
      (t.perm === 'conflicts' && canConflicts),
  );
  const tabs: TabItem[] = visible.map((t) => ({ id: t.id, label: t.label, icon: t.icon }));
  const initial = tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id ?? 'gate';
  const [active, setActive] = useState(initial);

  if (tabs.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={tabs} value={active} onChange={setActive} ariaLabel="Attendance modules" />
      <TabPanel id="gate" active={active === 'gate'}>
        {canGate && <GateTab />}
      </TabPanel>
      <TabPanel id="period" active={active === 'period'}>
        {canPeriod && <PeriodTab sections={sections} />}
      </TabPanel>
      <TabPanel id="conflicts" active={active === 'conflicts'}>
        {canConflicts && <ConflictsTab />}
      </TabPanel>
    </div>
  );
}

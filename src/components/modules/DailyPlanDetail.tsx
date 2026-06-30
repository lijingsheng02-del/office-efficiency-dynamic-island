import { DailyPlanPanel } from '../plan/DailyPlanPanel';
import { DetailShell } from './DetailShell';

type DailyPlanDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

export function DailyPlanDetail({ onBack, onClose }: DailyPlanDetailProps) {
  return (
    <DetailShell title="每日计划" onBack={onBack} onClose={onClose}>
      <DailyPlanPanel />
    </DetailShell>
  );
}

import { AppErrorBoundary } from './components/AppErrorBoundary';
import { DynamicIsland } from './components/DynamicIsland';
import { TempClipboardFloatingWindow } from './components/modules/TempClipboardFloatingWindow';

export default function App() {
  if (window.location.hash === '#temp-clipboard-window') {
    return (
      <AppErrorBoundary>
        <TempClipboardFloatingWindow />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <main className="app-shell">
        <DynamicIsland />
      </main>
    </AppErrorBoundary>
  );
}

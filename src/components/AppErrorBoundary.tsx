import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dynamic Island render failed', error, info.componentStack);
  }

  private reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-shell">
        <section className="app-error-card" role="alert">
          <strong>界面加载失败</strong>
          <p>本次渲染遇到异常，数据仍保存在本地。请先重新加载，如果持续出现再反馈问题。</p>
          <button type="button" onClick={this.reloadApp}>
            重新加载
          </button>
        </section>
      </main>
    );
  }
}

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

const CHUNK_ERROR =
  /Loading chunk|Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module|importing a module script failed/i;
const RELOAD_FLAG = 'chunk-reload-attempted';
const STABLE_DELAY = 3000;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ChunkErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  state: State = { hasError: false };
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidMount(): void {
    this.scheduleFlagClear();
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    if (prevState.hasError && !this.state.hasError) {
      this.scheduleFlagClear();
    }
  }

  componentWillUnmount(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  private scheduleFlagClear(): void {
    if (this.state.hasError) return;
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      sessionStorage.removeItem(RELOAD_FLAG);
    }, STABLE_DELAY);
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    if (CHUNK_ERROR.test(error.message)) {
      const alreadyAttempted = sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyAttempted) {
        sessionStorage.setItem(RELOAD_FLAG, 'true');
        window.location.reload();
        return;
      }
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-4 py-16"
          role="alert"
          aria-label="Erro ao carregar conteúdo"
        >
          <p className="text-center text-base text-slate-700">
            Não foi possível carregar esta parte do aplicativo. Atualize a página.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Atualizar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

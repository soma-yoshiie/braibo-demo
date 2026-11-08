import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/** Shows the error + a retry button instead of a blank screen. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BRAIBO crashed', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="boot-error">
          <h1>エラーが発生しました</h1>
          <pre>{this.state.error.message}\n{this.state.error.stack}</pre>
          <div className="boot-error__actions">
            <button onClick={() => this.setState({ error: null })}>続行を試す</button>
            <button onClick={() => location.reload()}>再読み込み</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

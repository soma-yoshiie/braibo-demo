import { ErrorBoundary } from './components/ErrorBoundary';
import { MatchScreen } from './screens/MatchScreen/MatchScreen';

export function App() {
  return (
    <ErrorBoundary>
      <MatchScreen />
    </ErrorBoundary>
  );
}

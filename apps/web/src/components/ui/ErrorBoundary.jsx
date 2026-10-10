import { Component } from 'react';

/**
 * A crash in one screen shows a friendly message instead of a blank page. `resetKey` (the route) clears the
 * error when the user navigates elsewhere.
 */
export class ErrorBoundary extends Component {
  state = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error) {
    console.error('Screen crashed:', error?.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notice notice-bad" role="alert">
        <h2>Something went wrong on this screen</h2>
        <p>The rest of the portal still works. Try again, or go back to the home page.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <a className="btn btn-secondary" href="/">
            Go home
          </a>
        </div>
      </div>
    );
  }
}

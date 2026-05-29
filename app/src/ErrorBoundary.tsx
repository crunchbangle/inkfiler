import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/** Renders any render/lifecycle/effect crash to screen instead of a blank window. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Also surface in the webview console.
    console.error("InkFiler crashed:", error, info);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          padding: 20,
          color: "#ffb4b4",
          background: "#1e1e22",
          fontFamily: "monospace",
          height: "100vh",
          overflow: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        <h2 style={{ color: "#ff7676" }}>InkFiler crashed</h2>
        <strong>{error.message}</strong>
        {"\n\n"}
        {error.stack}
        {info?.componentStack ? "\n\nComponent stack:" + info.componentStack : ""}
      </div>
    );
  }
}

import { useState } from "react";

interface CounterDemoProps {
  label: string;
  start: number;
}

export default function CounterDemo({ label, start }: CounterDemoProps) {
  const [count, setCount] = useState(start);

  return (
    <button
      type="button"
      className="counter-demo"
      onClick={() => setCount((current) => current + 1)}
      style={{
        border: "1px solid var(--theme-border)",
        borderRadius: "0.5rem",
        padding: "0.5rem 1rem",
        color: "var(--theme-text)",
        background: "var(--theme-surface, transparent)",
        cursor: "pointer",
      }}
    >
      {label}: {count}
    </button>
  );
}

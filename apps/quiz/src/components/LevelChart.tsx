import { MAX_LEVEL, MIN_LEVEL } from "@ai-in-learning/core";
import type { Level } from "@ai-in-learning/shared-types";

import styles from "./LevelChart.module.css";

/** The text alternative of the chart, for example "Level: 3, 4, 5, 4" (plan §13.3). */
export function levelChartDescription(history: readonly Level[]): string {
  return `Level: ${history.join(", ")}`;
}

/** The name of each point: "Start", then the question it follows. */
function pointLabel(index: number): string {
  return index === 0 ? "Start" : String(index);
}

// Drawing area, in SVG user units. The SVG scales to the width of its container.
const WIDTH = 640;
const HEIGHT = 220;
const LEFT = 40;
const RIGHT = 20;
const TOP = 16;
const BOTTOM = 44;

const LEVELS = Array.from(
  { length: MAX_LEVEL - MIN_LEVEL + 1 },
  (_, index): Level => MAX_LEVEL - index,
);

function y(level: Level): number {
  return TOP + ((MAX_LEVEL - level) / (MAX_LEVEL - MIN_LEVEL)) * (HEIGHT - TOP - BOTTOM);
}

/**
 * How the level evolved over the session (AC-7.1): the start level, then the
 * level after each answer. An inline SVG with a text alternative and a visually
 * hidden table holding the same values, with no chart library (plan §13.3).
 */
export function LevelChart({ history }: { readonly history: readonly Level[] }) {
  const step = (WIDTH - LEFT - RIGHT) / Math.max(history.length - 1, 1);
  const points = history.map((level, index) => ({ level, x: LEFT + index * step, y: y(level) }));
  const last = points.at(-1);

  return (
    <figure className={styles.figure} aria-labelledby="level-chart-caption">
      <figcaption id="level-chart-caption" className={styles.caption}>
        Your level after each question
      </figcaption>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={levelChartDescription(history)}
      >
        {LEVELS.map((level) => (
          <g key={level}>
            <line
              className={styles.grid}
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(level)}
              y2={y(level)}
            />
            <text
              className={styles.axisLabel}
              x={LEFT - 12}
              y={y(level)}
              textAnchor="end"
              dy="0.35em"
            >
              {level}
            </text>
          </g>
        ))}
        {points.map(({ x }, index) => (
          <text
            key={index}
            className={styles.axisLabel}
            x={x}
            y={HEIGHT - BOTTOM + 24}
            textAnchor="middle"
          >
            {pointLabel(index)}
          </text>
        ))}
        <polyline
          className={styles.line}
          points={points.map(({ x, y: pointY }) => `${String(x)},${String(pointY)}`).join(" ")}
        />
        {points.map(({ x, y: pointY }, index) => (
          <circle
            key={index}
            className={index === points.length - 1 ? styles.finalPoint : styles.point}
            cx={x}
            cy={pointY}
            r={index === points.length - 1 ? 7 : 4.5}
          />
        ))}
        {last === undefined ? null : (
          <text
            className={styles.finalLabel}
            x={last.x}
            y={last.y}
            dy={last.level === MAX_LEVEL ? "1.9em" : "-1.1em"}
            textAnchor="end"
          >
            {last.level}/{MAX_LEVEL}
          </text>
        )}
      </svg>
      <table className="visually-hidden">
        <caption>Level after each question</caption>
        <thead>
          <tr>
            <th scope="col">Question</th>
            <th scope="col">Level</th>
          </tr>
        </thead>
        <tbody>
          {history.map((level, index) => (
            <tr key={index}>
              <th scope="row">{pointLabel(index)}</th>
              <td>{level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

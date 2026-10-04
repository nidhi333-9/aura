// Chart colors for the history views. Every value is from the validated reference
// palette (dataviz skill, palette.md) - nothing eyeballed:
//   - productive / distraction are categorical slots 1 and 2 (blue, orange); the
//     validator passes this pair in light mode (worst colorblind-simulated separation
//     dE 24.7 against a target of 8; contrast >= 3:1 on the chart surface)
//   - neutral is the de-emphasis gray ("everything else"); at 2.5:1 on the surface it is
//     below the 3:1 mark floor, which is why every chart has a table view
//   - HEAT_STEPS is the blue sequential ramp, steps 100..700, light -> dark
// The app is light-only today. If a dark theme is added, this file is the one place to give
// each token a dark value (the dark steps are in the palette reference).

export const viz = {
  surface: "#fcfcfb",
  ink: { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781" },
  grid: "#e1e0d9", // hairline, solid, recessive
  baseline: "#c3c2b7",
  productive: "#2a78d6",
  distraction: "#eb6834",
  neutral: "#a3a199",
  noData: "#eeede8",
  good: "#006300", // delta text: up is good
  critical: "#d03b3b", // delta text: down is bad
};

export const HEAT_STEPS = [
  "#cde2fb", // 100
  "#9ec5f4", // 200
  "#6da7ec", // 300
  "#3987e5", // 400
  "#256abf", // 500
  "#184f95", // 600
  "#0d366b", // 700
];

// 0-100 focus -> one of the 7 equal-width buckets
export const heatIndex = (focus) =>
  Math.min(HEAT_STEPS.length - 1, Math.floor((focus / 100) * HEAT_STEPS.length));

export const heatColor = (focus) => HEAT_STEPS[heatIndex(focus)];

// A column with only its data end rounded (4px) and a square baseline.
export const topRoundedPath = (x, y, w, h, r = 4) => {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
};

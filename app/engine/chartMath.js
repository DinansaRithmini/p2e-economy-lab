// Helper functions for drawing charts. No React in here, so they can be tested in Node.

// The lowest and highest value a chart should show (forced values win)
function extent(values, forceMin, forceMax) {
  let min = forceMin !== undefined ? forceMin : Math.min(...values);
  let max = forceMax !== undefined ? forceMax : Math.max(...values);
  if (forceMax === undefined) max = max + (max - min) * 0.05;   // a little headroom on top
  if (max === min) { min = min - 0.5; max = max + 0.5; }        // a flat line still needs a range
  return { min, max };
}

// Left-to-right position of point i out of n
function scaleX(i, n, left, width) {
  return n <= 1 ? left : left + (i * width) / (n - 1);
}

// Top-to-bottom position of a value (bigger values are higher up the screen)
function scaleY(v, min, max, top, height) {
  return top + height - ((v - min) / (max - min)) * height;
}

// The "d" text of an SVG line through all the values
function linePath(values, min, max, box) {
  return values
    .map((v, i) => {
      const x = scaleX(i, values.length, box.left, box.width).toFixed(1);
      const y = scaleY(v, min, max, box.top, box.height).toFixed(1);
      return (i === 0 ? "M" : "L") + x + " " + y;
    })
    .join(" ");
}

// The "d" text of a shaded area between a low line and a high line (confidence band)
function bandPath(low, high, min, max, box) {
  const n = low.length;
  const point = (i, v) => scaleX(i, n, box.left, box.width).toFixed(1) + " " + scaleY(v, min, max, box.top, box.height).toFixed(1);
  const top = high.map((v, i) => (i === 0 ? "M" : "L") + point(i, v));
  const bottom = low.map((v, i) => "L" + point(i, v)).reverse();
  return top.concat(bottom).join(" ") + " Z";
}

// Short labels for the axis: 1500000 -> 1.5M, 0.0941 -> 0.094
function formatNumber(v) {
  const a = Math.abs(v);
  if (Number.isInteger(v) && a < 1e3) return String(v);   // 0, 50, 100 stay clean
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (a >= 1e4) return Math.round(v / 1e3) + "k";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "k";
  if (a >= 100) return String(Math.round(v));
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

module.exports = { extent, scaleX, scaleY, linePath, bandPath, formatNumber };

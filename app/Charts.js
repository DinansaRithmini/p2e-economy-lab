import { Fragment } from "react";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { bandPath, extent, formatNumber, linePath, scaleY } from "./engine/chartMath";

// A line chart. Pass `compare` to draw a second, grey dashed line (used for the baseline),
// and `envelope` ({ low, high }) to shade a likely range around the line (confidence band).
export function LineChart({ values, compare, envelope, width, height = 150, color = "#1f4fd8", min, max, bands, refLine }) {
  const pad = { left: 46, right: 10, top: 10, bottom: 22 };
  const box = { left: pad.left, top: pad.top, width: width - pad.left - pad.right, height: height - pad.top - pad.bottom };
  const all = values.concat(compare || [], envelope ? envelope.low.concat(envelope.high) : []);
  const { min: lo, max: hi } = extent(all, min, max);
  const grid = [lo, (lo + hi) / 2, hi];
  const y = (v) => scaleY(v, lo, hi, box.top, box.height);

  return (
    <Svg width={width} height={height}>
      {bands &&
        bands.map((b) => (
          <Rect key={b.label} x={box.left} y={y(b.to)} width={box.width} height={y(b.from) - y(b.to)} fill={b.color} opacity={0.15} />
        ))}
      {grid.map((g, i) => (
        <Fragment key={i}>
          <Line x1={box.left} x2={box.left + box.width} y1={y(g)} y2={y(g)} stroke="#dddddd" strokeWidth={1} />
          <SvgText x={box.left - 6} y={y(g) + 4} fontSize="11" fill="#666666" textAnchor="end">
            {formatNumber(g)}
          </SvgText>
        </Fragment>
      ))}
      {refLine && refLine.value >= lo && refLine.value <= hi && (
        <Fragment>
          <Line x1={box.left} x2={box.left + box.width} y1={y(refLine.value)} y2={y(refLine.value)} stroke="#555555" strokeWidth={1} strokeDasharray="4 3" />
          <SvgText x={box.left + box.width} y={y(refLine.value) - 4} fontSize="11" fill="#555555" textAnchor="end">
            {refLine.label}
          </SvgText>
        </Fragment>
      )}
      {envelope && <Path d={bandPath(envelope.low, envelope.high, lo, hi, box)} fill={color} opacity={0.18} />}
      {compare && <Path d={linePath(compare, lo, hi, box)} stroke="#8a8f98" strokeWidth={2.5} fill="none" strokeDasharray="6 4" />}
      <Path d={linePath(values, lo, hi, box)} stroke={color} strokeWidth={2.5} fill="none" />
      <SvgText x={box.left} y={height - 4} fontSize="11" fill="#666666">
        {"day 1"}
      </SvgText>
      <SvgText x={box.left + box.width} y={height - 4} fontSize="11" fill="#666666" textAnchor="end">
        {"day " + values.length}
      </SvgText>
    </Svg>
  );
}

// Bars: first day vs last day for each player type
export function GroupedBars({ groups, width, height = 180 }) {
  const pad = { left: 10, right: 10, top: 18, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const biggest = Math.max(1, ...groups.flatMap((g) => [g.first, g.last]));
  const groupW = innerW / groups.length;
  const barW = Math.min(26, groupW / 3);
  const barH = (v) => (v / biggest) * innerH;

  return (
    <Svg width={width} height={height}>
      {groups.map((g, i) => {
        const x0 = pad.left + i * groupW + groupW / 2;
        return (
          <Fragment key={g.label}>
            <Rect x={x0 - barW - 2} y={pad.top + innerH - barH(g.first)} width={barW} height={barH(g.first)} fill="#b9c6f2" />
            <Rect x={x0 + 2} y={pad.top + innerH - barH(g.last)} width={barW} height={barH(g.last)} fill="#1f4fd8" />
            <SvgText x={x0 - barW / 2 - 2} y={pad.top + innerH - barH(g.first) - 4} fontSize="11" fill="#444444" textAnchor="middle">{String(g.first)}</SvgText>
            <SvgText x={x0 + barW / 2 + 2} y={pad.top + innerH - barH(g.last) - 4} fontSize="11" fill="#444444" textAnchor="middle">{String(g.last)}</SvgText>
            <SvgText x={x0} y={height - 8} fontSize="12" fill="#333333" textAnchor="middle">{g.label}</SvgText>
          </Fragment>
        );
      })}
    </Svg>
  );
}

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GroupedBars, LineChart } from "./Charts";
import { C, R, BAND_COLOURS, card, useLayout } from "./theme";
import { Columns, Grid } from "./Layout";
import { formatNumber } from "./engine/chartMath";
import { NOTICE, describeConfig, describeResilience, explainResult, resilience } from "./engine/appLogic";
import { confidenceBand, describeBand, describeFix, suggestFix } from "./engine/advisor";

// A card with a title, a chart and a plain-language caption
function ChartCard({ title, caption, children }) {
  return (
    <View style={card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

// The score bar: four coloured zones and a marker
function ScoreBar({ score }) {
  return (
    <View>
      <View style={styles.scoreBar}>
        <View style={{ flex: 40, backgroundColor: BAND_COLOURS["Death Spiral"] }} />
        <View style={{ flex: 20, backgroundColor: BAND_COLOURS.Warning }} />
        <View style={{ flex: 20, backgroundColor: BAND_COLOURS.Caution }} />
        <View style={{ flex: 20, backgroundColor: BAND_COLOURS.Sustainable }} />
      </View>
      <View style={[styles.marker, { left: Math.max(0, Math.min(100, score)) + "%" }]} />
      <View style={styles.scoreLabels}>
        <Text style={styles.tiny}>Death Spiral</Text>
        <Text style={styles.tiny}>Warning</Text>
        <Text style={styles.tiny}>Caution</Text>
        <Text style={styles.tiny}>Sustainable</Text>
      </View>
    </View>
  );
}

// The score zones, shaded behind score charts
const SCORE_BANDS = [
  { label: "Death Spiral", from: 0, to: 40, color: BAND_COLOURS["Death Spiral"] },
  { label: "Warning", from: 40, to: 60, color: BAND_COLOURS.Warning },
  { label: "Caution", from: 60, to: 80, color: BAND_COLOURS.Caution },
  { label: "Sustainable", from: 80, to: 100, color: BAND_COLOURS.Sustainable },
];

const TABS = ["Overview", "Charts", "Advice"];

export default function Dashboard({ result, baseline, onBack, onSaveBaseline, onCompare, onApplyFix }) {
  const [tab, setTab] = useState("Overview");
  const [fix, setFix] = useState(null);
  const [band, setBand] = useState(null);
  const [busy, setBusy] = useState(null);   // "fix" or "band" while working

  // Let the button show "working" before the (blocking) calculation starts
  function later(kind, work) {
    setBusy(kind);
    setTimeout(() => { work(); setBusy(null); }, 30);
  }
  const L = useLayout();
  const chartWidth = L.wide ? L.halfChart : L.fullChart;   // two charts per row on a wide screen
  const { config, history, scores, alert, elapsed } = result;
  const last = history[history.length - 1];
  const first = history[0];
  const finalScore = scores[scores.length - 1];
  const priceChange = Math.round((last.price / config.startPrice - 1) * 100);
  const types = ["casual", "grinder", "investor", "whale"];
  const isBaseline = baseline === result;
  const colour = BAND_COLOURS[finalScore.band];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, L.wide && styles.contentWide]}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Text style={styles.back}>← Change settings</Text>
      </Pressable>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>{describeConfig(config)}</Text>

      <View style={[styles.banner, alert.triggered ? styles.bannerAlert : styles.bannerOk]}>
        <Text style={[styles.bannerText, alert.triggered && { color: "#ffffff" }]}>
          {alert.triggered
            ? "⚠ Death Spiral Alert: triggered on day " + alert.day + ". The price is falling while more players cash out."
            : "No Death Spiral Alert triggered"}
        </Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "Overview" && (
        <Columns wide={L.wide}>
          <View>
          <View style={card}>
            <Text style={styles.cardTitle}>Sustainability Score</Text>
            <Text style={[styles.bigScore, { color: colour }]}>{finalScore.score.toFixed(0)}</Text>
            <Text style={[styles.bandName, { color: colour }]}>{finalScore.band}</Text>
            <ScoreBar score={finalScore.score} />
          </View>

          </View>
          <View>
          <View style={[card, styles.explainCard]}>
            <Text style={styles.cardTitle}>What this means</Text>
            {explainResult(result).map((line, i) => (
              <Text key={i} style={styles.explainLine}>{"• " + line}</Text>
            ))}
          </View>

          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{last.price.toFixed(3)}</Text>
              <Text style={styles.tileLabel}>{"final price (" + priceChange + "%)"}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{last.active}</Text>
              <Text style={styles.tileLabel}>active players</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{formatNumber(last.supply)}</Text>
              <Text style={styles.tileLabel}>tokens in circulation</Text>
            </View>
          </View>

          {config.stress && (
            <View style={card}>
              <Text style={styles.cardTitle}>Stress test result</Text>
              <Text style={styles.noteText}>{describeResilience(resilience(result))}</Text>
            </View>
          )}

          {isBaseline ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>This run is saved as your baseline. Go back, change the design or add a stress test, then run again to compare.</Text>
            </View>
          ) : (
            <View>
              {baseline && (
                <Pressable onPress={onCompare} style={styles.compareButton}>
                  <Text style={styles.compareText}>Compare with baseline</Text>
                </Pressable>
              )}
              <Pressable onPress={onSaveBaseline} style={styles.saveButton}>
                <Text style={styles.saveText}>{baseline ? "Save this run as the new baseline" : "Save this run as the baseline"}</Text>
              </Pressable>
            </View>
          )}
          </View>
        </Columns>
      )}

      {tab === "Charts" && (
        <Grid wide={L.wide}>
          <ChartCard title="Token price" caption={"Changed " + priceChange + "% from day 1 to day " + config.days + "."}>
            <LineChart values={history.map((h) => h.price)} width={chartWidth} color={C.primary} />
          </ChartCard>
          <ChartCard title="Sustainability Score over time" caption="Above 80 is healthy. Below 40 is a death spiral.">
            <LineChart values={scores.map((s) => s.score)} width={chartWidth} color={C.ink} min={0} max={100} bands={SCORE_BANDS} />
          </ChartCard>
          <ChartCard title="Faucet-to-Sink Ratio" caption="Tokens created for every token burned. Near 1 is balanced. Higher means inflation.">
            <LineChart values={history.map((h) => h.faucetToSink)} width={chartWidth} color="#d2691e" min={0} refLine={{ value: 1, label: "balanced = 1" }} />
          </ChartCard>
          <ChartCard title="Active players" caption={first.active + " players on day 1, " + last.active + " on day " + config.days + "."}>
            <LineChart values={history.map((h) => h.active)} width={chartWidth} color={C.good} />
          </ChartCard>
          <ChartCard title="Who stayed? Players by type" caption="Light bar = day 1. Dark bar = last day. Income-dependent Grinders leave first when earnings fall.">
            <GroupedBars
              width={chartWidth}
              groups={types.map((t) => ({ label: t[0].toUpperCase() + t.slice(1), first: first.activeByType[t], last: last.activeByType[t] }))}
            />
          </ChartCard>
        </Grid>
      )}

      {tab === "Advice" && (
        <Columns wide={L.wide}>
          <View style={card}>
            <Text style={styles.cardTitle}>Suggest a fix</Text>
            <Text style={styles.caption}>Finds the smallest change to sinks and burn that makes this design Sustainable.</Text>
            {!fix && (
              <Pressable disabled={busy !== null} onPress={() => later("fix", () => setFix(suggestFix(config)))} style={styles.adviceButton}>
                <Text style={styles.adviceButtonText}>{busy === "fix" ? "Searching for a fix…" : "Suggest a fix"}</Text>
              </Pressable>
            )}
            {fix && (
              <View style={styles.adviceBox}>
                <Text style={styles.adviceResult}>{describeFix(fix, config)}</Text>
                <Text style={styles.tiny}>{"Checked " + (fix.screened + fix.fullChecks) + " designs in " + fix.ms + " ms"}</Text>
                {fix.status !== "already" && fix.sinkRate !== undefined && (fix.sinkRate !== config.sinkRate || fix.burnRate !== config.burnRate) && (
                  <Pressable onPress={() => onApplyFix({ sinkRate: fix.sinkRate, burnRate: fix.burnRate })} style={styles.applyButton}>
                    <Text style={styles.applyText}>Apply this change and run</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          <View style={card}>
            <Text style={styles.cardTitle}>Check uncertainty</Text>
            <Text style={styles.caption}>Runs this design 10 times with player behaviour changed by up to ±20%, to show how far the result can be trusted.</Text>
            {!band && (
              <Pressable disabled={busy !== null} onPress={() => later("band", () => setBand(confidenceBand(config)))} style={styles.adviceButton}>
                <Text style={styles.adviceButtonText}>{busy === "band" ? "Running 10 versions…" : "Check uncertainty (10 runs)"}</Text>
              </Pressable>
            )}
            {band && (
              <View style={styles.adviceBox}>
                <Text style={styles.adviceResult}>{describeBand(band)}</Text>
                <LineChart values={band.median} envelope={{ low: band.low, high: band.high }} width={chartWidth} color={C.ink} min={0} max={100} bands={SCORE_BANDS} />
                <Text style={styles.caption}>Line: the middle run. Shaded area: the middle 80% of 10 runs, each with a new random seed and behaviour settings changed by up to ±20%.</Text>
                <Text style={styles.tiny}>{band.runs + " runs in " + band.ms + " ms"}</Text>
              </View>
            )}
          </View>
        </Columns>
      )}

      <Text style={styles.footer}>{"Simulated in " + elapsed + " ms"}</Text>
      <Text style={styles.notice}>{NOTICE}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 60 },
  contentWide: { maxWidth: 1200, width: "100%", alignSelf: "center", paddingHorizontal: 32, paddingTop: 36 },
  back: { fontSize: 16, color: C.primary, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "800", color: C.ink },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  banner: { padding: 14, borderRadius: R.button, marginBottom: 14 },
  bannerOk: { backgroundColor: C.goodSoft },
  bannerAlert: { backgroundColor: C.danger },
  bannerText: { fontSize: 15, fontWeight: "600", color: "#1a5c3a" },
  tabs: { flexDirection: "row", backgroundColor: "#e4e8f0", borderRadius: R.button, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabOn: { backgroundColor: C.card },
  tabText: { fontSize: 15, color: C.muted, fontWeight: "600" },
  tabTextOn: { color: C.ink },
  cardTitle: { fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 6 },
  caption: { fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 18 },
  bigScore: { fontSize: 56, fontWeight: "800", textAlign: "center" },
  bandName: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 14 },
  scoreBar: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden" },
  marker: { position: "absolute", top: -4, width: 4, height: 22, marginLeft: -2, backgroundColor: "#000000", borderRadius: 2 },
  scoreLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  explainCard: { backgroundColor: C.primarySoft, borderColor: "#cfdaf8" },
  explainLine: { fontSize: 14, color: C.ink, lineHeight: 20, marginTop: 4 },
  tiny: { fontSize: 11, color: C.muted },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 14 },
  tile: { flex: 1, padding: 12, borderRadius: R.button, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tileValue: { fontSize: 20, fontWeight: "800", color: C.ink },
  tileLabel: { fontSize: 11, color: C.muted, marginTop: 2, textAlign: "center" },
  compareButton: { backgroundColor: C.primary, paddingVertical: 14, borderRadius: R.button, alignItems: "center", marginBottom: 8 },
  compareText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  saveButton: { borderWidth: 1, borderColor: C.primary, backgroundColor: C.card, paddingVertical: 12, borderRadius: R.button, alignItems: "center", marginBottom: 14 },
  saveText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  noteBox: { padding: 12, borderRadius: R.button, backgroundColor: C.primarySoft, marginBottom: 14 },
  noteText: { fontSize: 14, color: "#21388f", lineHeight: 20 },
  adviceButton: { borderWidth: 1, borderColor: C.good, paddingVertical: 12, borderRadius: R.button, alignItems: "center", marginTop: 12 },
  adviceButtonText: { color: C.good, fontSize: 15, fontWeight: "700" },
  adviceBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  adviceResult: { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 4, lineHeight: 21 },
  applyButton: { backgroundColor: C.good, paddingVertical: 12, borderRadius: R.button, alignItems: "center", marginTop: 10 },
  applyText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  footer: { fontSize: 13, color: C.faint, textAlign: "center", marginTop: 6 },
  notice: { fontSize: 12, color: C.faint, textAlign: "center", marginTop: 8 },
});

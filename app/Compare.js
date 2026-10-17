import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart } from "./Charts";
import { alignSeries, describeConfig, summarise, verdict } from "./engine/appLogic";
import { C, R, BAND_COLOURS, useLayout } from "./theme";
import { Columns, Grid } from "./Layout";

// One row of the side-by-side table
function Row({ label, left, right, leftColour, rightColour }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, leftColour && { color: leftColour }]}>{left}</Text>
      <Text style={[styles.rowValue, rightColour && { color: rightColour }]}>{right}</Text>
    </View>
  );
}

function CompareChart({ title, base, current, width, options }) {
  const [a, b] = alignSeries(base, current);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <LineChart values={b} compare={a} width={width} color={C.primary} {...options} />
      <View style={styles.legend}>
        <Text style={styles.legendBase}>- - Baseline</Text>
        <Text style={styles.legendCurrent}>— Current</Text>
      </View>
    </View>
  );
}

export default function Compare({ baseline, current, onBack }) {
  const L = useLayout();
  const chartWidth = L.wide ? L.halfChart : L.fullChart;
  const b = summarise(baseline);
  const c = summarise(current);
  const money = (x) => x.toFixed(3);
  const change = (x) => Math.round(x * 100) + "%";
  const alertText = (day) => (day === null ? "none" : "day " + day);
  const shared = Math.min(b.days, c.days);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, L.wide && styles.contentWide]}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back to dashboard</Text>
      </Pressable>
      <Text style={styles.title}>Comparison</Text>

      <View style={styles.verdictBox}>
        <Text style={styles.verdictText}>{verdict(b, c)}</Text>
      </View>

      <Columns wide={L.wide}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Baseline</Text>
        <Text style={styles.settings}>{describeConfig(baseline.config)}</Text>
        <Text style={[styles.cardTitle, { marginTop: 12 }]}>Current</Text>
        <Text style={styles.settings}>{describeConfig(current.config)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel} />
          <Text style={styles.headBase}>Baseline</Text>
          <Text style={styles.headCurrent}>Current</Text>
        </View>
        <Row label="Score" left={b.score.toFixed(0) + " · " + b.band} right={c.score.toFixed(0) + " · " + c.band} leftColour={BAND_COLOURS[b.band]} rightColour={BAND_COLOURS[c.band]} />
        <Row label="Final price" left={money(b.price) + " (" + change(b.priceChange) + ")"} right={money(c.price) + " (" + change(c.priceChange) + ")"} />
        <Row label="Active players" left={String(b.active)} right={String(c.active)} />
        <Row label="Faucet-to-Sink" left={b.faucetToSink.toFixed(2)} right={c.faucetToSink.toFixed(2)} />
        <Row label="Death Spiral Alert" left={alertText(b.alertDay)} right={alertText(c.alertDay)} leftColour={b.alertDay === null ? undefined : "#c0392b"} rightColour={c.alertDay === null ? undefined : "#c0392b"} />
      </View>
      </Columns>

      {b.days !== c.days && (
        <Text style={styles.note}>{"The runs have different lengths, so the charts show only the first " + shared + " days."}</Text>
      )}

      <Grid wide={L.wide}>
      <CompareChart
        title="Sustainability Score over time"
        base={baseline.scores.map((s) => s.score)}
        current={current.scores.map((s) => s.score)}
        width={chartWidth}
        options={{ min: 0, max: 100 }}
      />
      <CompareChart title="Token price" base={baseline.history.map((h) => h.price)} current={current.history.map((h) => h.price)} width={chartWidth} />
      <CompareChart title="Active players" base={baseline.history.map((h) => h.active)} current={current.history.map((h) => h.active)} width={chartWidth} />
      </Grid>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 60 },
  contentWide: { maxWidth: 1200, width: "100%", alignSelf: "center", paddingHorizontal: 32, paddingTop: 36 },
  back: { fontSize: 16, color: C.primary, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "800", color: C.ink, marginBottom: 12 },
  verdictBox: { padding: 14, borderRadius: R.button, backgroundColor: C.primarySoft, marginBottom: 14 },
  verdictText: { fontSize: 16, fontWeight: "700", color: "#21388f", lineHeight: 22 },
  card: { padding: 16, borderRadius: R.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 4 },
  settings: { fontSize: 13, color: "#555555" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#d5d9de" },
  rowLabel: { flex: 1.1, fontSize: 14, color: "#555555" },
  rowValue: { flex: 1.3, fontSize: 14, fontWeight: "600" },
  headBase: { flex: 1.3, fontSize: 14, fontWeight: "700", color: "#6b7078" },
  headCurrent: { flex: 1.3, fontSize: 14, fontWeight: "700", color: C.primary },
  note: { fontSize: 13, color: "#777777", marginBottom: 10 },
  legend: { flexDirection: "row", gap: 18, marginTop: 6 },
  legendBase: { fontSize: 13, color: "#6b7078" },
  legendCurrent: { fontSize: 13, color: C.primary, fontWeight: "600" },
});

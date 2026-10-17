import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import Dashboard from "./Dashboard";
import Compare from "./Compare";
import { C, R, card, useLayout } from "./theme";
import { DEFAULT_SETTINGS, HELP, NOTICE, POPULATIONS, PRESETS, buildConfig, describeConfig, normalise, runDesign, summarise } from "./engine/appLogic";

// One labelled slider, with an optional (i) button that shows a plain-language explanation
function Control({ label, valueText, value, min, max, step, onChange, help }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.control}>
      <View style={styles.controlHeader}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {help && (
            <Pressable onPress={() => setOpen(!open)} hitSlop={10} style={[styles.info, open && styles.infoOn]}>
              <Text style={[styles.infoText, open && styles.infoTextOn]}>i</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.value}>{valueText}</Text>
      </View>
      {open && <Text style={styles.helpText}>{help}</Text>}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        minimumTrackTintColor={C.primary}
        thumbTintColor={C.primary}
        onValueChange={(v) => onChange(Math.round(v * 100) / 100)}
      />
    </View>
  );
}

// A card with a title and an optional (i) explanation
function Section({ title, help, children }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.section}>{title}</Text>
        {help && (
          <Pressable onPress={() => setOpen(!open)} hitSlop={10} style={[styles.info, open && styles.infoOn]}>
            <Text style={[styles.infoText, open && styles.infoTextOn]}>i</Text>
          </Pressable>
        )}
      </View>
      {open && <Text style={styles.helpText}>{help}</Text>}
      {children}
    </View>
  );
}

// A row of buttons where one is selected
function Choice({ options, value, onChange, label }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[styles.choice, value === o && styles.choiceOn]}>
          <Text style={[styles.choiceText, value === o && styles.choiceTextOn]}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const STRESS_OPTIONS = [
  { value: "none", title: "None", text: "Run the design as it is" },
  { value: "whale", title: "Whale withdrawal", text: "Whales cash out 20% of their holdings on day 20" },
  { value: "fewer", title: "Fewer new players", text: "50% fewer new players join from day 20" },
  { value: "blackswan", title: "Black swan (crash or hack)", text: "On day 20 the price falls 50% and 30% of players sell everything and leave" },
];

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [result, setResult] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [screen, setScreen] = useState("configure");
  const [runCount, setRunCount] = useState(0);
  const [preset, setPreset] = useState("axie");
  const L = useLayout();

  const update = (patch) => { setSettings({ ...settings, ...patch }); setPreset(null); };
  const setMix = (patch) => update({ mix: { ...settings.mix, ...patch } });
  const shares = normalise(settings.mix);
  const pct = (x) => Math.round(x * 100) + "%";

  // Run a design and remember the settings it came from (used by "Apply this change and run")
  function runWith(s) {
    setSettings(s);
    setResult({ ...runDesign(buildConfig(s)), settings: s });
    setRunCount(runCount + 1);
    setScreen("dashboard");
  }
  const run = () => runWith(settings);

  function choosePreset(p) {
    setSettings({ ...settings, ...p.settings });
    setPreset(p.id);
  }

  if (screen === "compare" && baseline && result) {
    return <Compare baseline={baseline} current={result} onBack={() => setScreen("dashboard")} />;
  }
  if (screen === "dashboard" && result) {
    return (
      <Dashboard
        key={runCount}
        result={result}
        baseline={baseline}
        onBack={() => setScreen("configure")}
        onSaveBaseline={() => setBaseline(result)}
        onCompare={() => setScreen("compare")}
        onApplyFix={(patch) => runWith({ ...result.settings, ...patch })}
      />
    );
  }

  const runButton = (
    <Pressable onPress={run} style={[styles.runButton, L.wide && styles.runButtonWide]}>
      <Text style={styles.runText}>Run simulation</Text>
    </Pressable>
  );

  const economy = (
    <Section title="Token economy">
      <Control label="Reward size (faucet)" help={HELP.faucet} valueText={pct(settings.faucet)} value={settings.faucet} min={0.5} max={1.5} step={0.1} onChange={(v) => update({ faucet: v })} />
      <Control label="Sink strength" help={HELP.sinkRate} valueText={pct(settings.sinkRate)} value={settings.sinkRate} min={0} max={0.5} step={0.05} onChange={(v) => update({ sinkRate: v })} />
      <Control label="Fixed burn (fees)" help={HELP.burnRate} valueText={pct(settings.burnRate)} value={settings.burnRate} min={0} max={0.3} step={0.05} onChange={(v) => update({ burnRate: v })} />
      <Control label="New players per day" help={HELP.newPlayers} valueText={String(settings.newPlayers)} value={settings.newPlayers} min={0} max={60} step={5} onChange={(v) => update({ newPlayers: v })} />
    </Section>
  );

  const playerMix = (
    <Section title="Player mix" help={HELP.mix}>
      <View style={styles.mixBar}>
        {[["casual", "#7aa2f7"], ["grinder", "#e8833a"], ["investor", "#9b6fd6"], ["whale", "#2bb3a3"]].map(([t, colour]) => (
          <View key={t} style={{ flex: Math.max(shares[t], 0.001), backgroundColor: colour }} />
        ))}
      </View>
      <Text style={styles.mixSummary}>
        Casual {pct(shares.casual)} · Grinder {pct(shares.grinder)} · Investor {pct(shares.investor)} · Whale {pct(shares.whale)}
      </Text>
      <Control label="Casual" valueText={String(settings.mix.casual)} value={settings.mix.casual} min={0} max={100} step={5} onChange={(v) => setMix({ casual: v })} />
      <Control label="Grinder" valueText={String(settings.mix.grinder)} value={settings.mix.grinder} min={0} max={100} step={5} onChange={(v) => setMix({ grinder: v })} />
      <Control label="Investor" valueText={String(settings.mix.investor)} value={settings.mix.investor} min={0} max={100} step={5} onChange={(v) => setMix({ investor: v })} />
      <Control label="Whale" valueText={String(settings.mix.whale)} value={settings.mix.whale} min={0} max={100} step={5} onChange={(v) => setMix({ whale: v })} />
    </Section>
  );

  const runSetup = (
    <View>
      <Section title="Simulation length" help={HELP.days}>
        <Choice options={[30, 60, 90]} value={settings.days} onChange={(d) => update({ days: d })} label={(d) => d + " days"} />
      </Section>
      <Section title="Starting players" help={HELP.population}>
        <Choice options={POPULATIONS} value={settings.population} onChange={(n) => update({ population: n })} label={(n) => String(n)} />
      </Section>
      <Section title="Stress test" help={HELP.stress}>
        {STRESS_OPTIONS.map((o) => (
          <Pressable key={o.value} onPress={() => update({ stress: o.value })} style={[styles.stressOption, settings.stress === o.value && styles.stressOptionOn]}>
            <View style={[styles.radio, settings.stress === o.value && styles.radioOn]} />
            <View style={styles.stressBody}>
              <Text style={styles.stressTitle}>{o.title}</Text>
              <Text style={styles.stressText}>{o.text}</Text>
            </View>
          </Pressable>
        ))}
      </Section>
    </View>
  );

  const presetCards = PRESETS.map((p) => (
    <Pressable key={p.id} onPress={() => choosePreset(p)} style={[styles.preset, L.wide && styles.presetWide, preset === p.id && styles.presetOn]}>
      <Text style={[styles.presetTitle, preset === p.id && styles.presetTitleOn]}>{p.title}</Text>
      <Text style={[styles.presetText, preset === p.id && styles.presetTextOn]}>{p.text}</Text>
    </Pressable>
  ));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, L.wide && styles.contentWide]}>
        <View style={L.wide && styles.headerWide}>
          <View style={L.wide && { flex: 1 }}>
            <Text style={[styles.title, L.wide && styles.titleWide]}>P2E Economy Lab</Text>
            <Text style={styles.subtitle}>Design a token economy, then test it before launch</Text>
          </View>
          {L.wide && <View style={styles.headerRun}>{runButton}</View>}
        </View>

        {baseline && (
          <View style={styles.baselineBox}>
            <Text style={styles.baselineTitle}>Baseline saved: score {summarise(baseline).score.toFixed(0)} · {summarise(baseline).band}</Text>
            <Text style={styles.baselineText}>{describeConfig(baseline.config)}</Text>
            <Pressable onPress={() => setBaseline(null)}>
              <Text style={styles.linkText}>Clear baseline</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.kicker}>START FROM</Text>
        {L.wide ? (
          <View style={styles.presetGrid}>{presetCards}</View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>{presetCards}</ScrollView>
        )}

        {L.wide ? (
          <View style={styles.columns}>
            <View style={styles.column}>{economy}{playerMix}</View>
            <View style={styles.column}>{runSetup}</View>
          </View>
        ) : (
          <View>{economy}{playerMix}{runSetup}</View>
        )}

        <View style={styles.links}>
          <Pressable onPress={() => { setSettings(DEFAULT_SETTINGS); setPreset("axie"); }} style={styles.linkButton}>
            <Text style={styles.linkText}>Reset to defaults</Text>
          </Pressable>
          {result && (
            <Pressable onPress={() => setScreen("dashboard")} style={styles.linkButton}>
              <Text style={styles.linkText}>Open last dashboard</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.notice}>{NOTICE}</Text>
      </ScrollView>

      {!L.wide && <View style={styles.runBar}>{runButton}</View>}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 120 },
  contentWide: { maxWidth: 1200, width: "100%", alignSelf: "center", paddingHorizontal: 32, paddingTop: 36, paddingBottom: 48 },
  headerWide: { flexDirection: "row", alignItems: "center", gap: 24, marginBottom: 8 },
  titleWide: { fontSize: 32 },
  headerRun: { width: 260 },
  presetGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  presetWide: { flex: 1, width: undefined },
  columns: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  column: { flex: 1 },
  runButtonWide: { paddingVertical: 14 },
  title: { fontSize: 28, fontWeight: "800", color: C.ink },
  subtitle: { fontSize: 15, color: C.muted, marginTop: 4, marginBottom: 16 },
  kicker: { fontSize: 12, fontWeight: "700", color: C.faint, letterSpacing: 1, marginBottom: 8 },
  presetRow: { gap: 10, paddingBottom: 16 },
  preset: { width: 170, padding: 12, borderRadius: R.button, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  presetOn: { backgroundColor: C.primary, borderColor: C.primary },
  presetTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  presetTitleOn: { color: "#fff" },
  presetText: { fontSize: 12, color: C.muted, marginTop: 4 },
  presetTextOn: { color: "#dbe5ff" },
  baselineBox: { marginBottom: 14, padding: 12, borderRadius: R.button, backgroundColor: C.primarySoft },
  baselineTitle: { fontSize: 15, fontWeight: "700", color: "#21388f" },
  baselineText: { fontSize: 12, color: "#3d4f9a", marginTop: 4, marginBottom: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  section: { fontSize: 17, fontWeight: "700", color: C.ink, flex: 1 },
  control: { marginBottom: 4 },
  controlHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 15, color: C.ink },
  value: { fontSize: 15, fontWeight: "700", color: C.primary },
  slider: { width: "100%", height: 36 },
  info: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: C.faint, alignItems: "center", justifyContent: "center" },
  infoOn: { backgroundColor: C.primary, borderColor: C.primary },
  infoText: { fontSize: 12, fontWeight: "700", color: C.faint },
  infoTextOn: { color: "#fff" },
  helpText: { fontSize: 13, color: C.muted, backgroundColor: C.page, padding: 10, borderRadius: 10, marginTop: 6, marginBottom: 6, lineHeight: 18 },
  mixBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 4, marginBottom: 8 },
  mixSummary: { fontSize: 13, color: C.muted, marginBottom: 6 },
  choiceRow: { flexDirection: "row", gap: 10 },
  choice: { flex: 1, paddingVertical: 11, borderRadius: R.button, borderWidth: 1, borderColor: C.line, backgroundColor: C.page, alignItems: "center" },
  choiceOn: { backgroundColor: C.primary, borderColor: C.primary },
  choiceText: { fontSize: 15, color: C.ink },
  choiceTextOn: { color: "#fff", fontWeight: "700" },
  stressOption: { flexDirection: "row", gap: 12, padding: 12, borderRadius: R.button, borderWidth: 1, borderColor: C.line, marginBottom: 8, alignItems: "center" },
  stressOptionOn: { borderColor: C.danger, backgroundColor: C.dangerSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.faint },
  radioOn: { borderColor: C.danger, backgroundColor: C.danger },
  stressBody: { flex: 1 },
  stressTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  stressText: { fontSize: 13, color: C.muted, marginTop: 2 },
  links: { alignItems: "center" },
  linkButton: { paddingVertical: 8 },
  linkText: { color: C.primary, fontSize: 15 },
  notice: { fontSize: 12, color: C.faint, textAlign: "center", marginTop: 8 },
  runBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
  runButton: { backgroundColor: C.good, paddingVertical: 15, borderRadius: R.button, alignItems: "center" },
  runText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

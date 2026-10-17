import { Children } from "react";
import { View } from "react-native";

// On a wide screen, put the children side by side in equal columns; on a phone, stack them.
export function Columns({ wide, children }) {
  const items = Children.toArray(children);
  if (!wide) return <View>{items}</View>;
  return (
    <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
      {items.map((child, i) => <View key={i} style={{ flex: 1, minWidth: 0 }}>{child}</View>)}
    </View>
  );
}

// On a wide screen, lay the children out two per row; on a phone, stack them.
export function Grid({ wide, children }) {
  const items = Children.toArray(children);
  if (!wide) return <View>{items}</View>;
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View>
      {rows.map((pair, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 16, alignItems: "stretch" }}>
          {pair.map((child, i) => <View key={i} style={{ flex: 1, minWidth: 0 }}>{child}</View>)}
          {pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

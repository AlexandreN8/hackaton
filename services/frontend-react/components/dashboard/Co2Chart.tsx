"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Leaf } from "lucide-react";

export interface Co2DataPoint {
  mix: string;
  [techno: string]: number | string;
}

const TECHNO_COLORS: Record<string, string> = {
  AC: "#3b82f6",
  IC: "#22c55e",
  RDHx: "#f97316",
  DLC: "#a855f7",
};

const MIX_SHORT: Record<string, string> = {
  "Mix Renouvelable": "Renouv.",
  "Mix Nucléaire pur": "Nucléaire",
  "Mix Décarboné": "Décarboné",
  "Mix Moyen": "Moyen",
  "États-Unis": "USA",
  "Mix Fossile": "Fossile",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <div
          key={p.dataKey}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: p.fill }}
            />
            <span className="text-white/60">{p.dataKey}</span>
          </div>
          <span className="font-mono font-semibold text-white">
            {Number(p.value).toLocaleString("fr-FR")} t
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Co2Chart({
  data,
  technos,
}: {
  data: Co2DataPoint[];
  technos: string[];
}) {
  if (!data || data.length === 0) {
    return (
      <Card className="border border-white/8 bg-white/4">
        <CardContent className="h-72 flex items-center justify-center">
          <p className="text-white/30 text-sm">
            Lance un calcul pour afficher le graphique
          </p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    mixLabel: MIX_SHORT[d.mix] ?? d.mix,
  }));

  return (
    <Card className="border border-white/8 bg-white/4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
          <Leaf className="w-4 h-4 text-green-400" />
          Émissions CO₂e (t/an)
        </CardTitle>
        <p className="text-xs text-white/40">
          Par scénario de mix électrique — une barre par technologie
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={formattedData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            barGap={3}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="mixLabel"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              formatter={(value) => (
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{value}</span>
              )}
            />
            {technos.map((techno) => (
              <Bar
                key={techno}
                dataKey={techno}
                fill={TECHNO_COLORS[techno] ?? "#94a3b8"}
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

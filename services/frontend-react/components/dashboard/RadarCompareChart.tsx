"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Target } from "lucide-react";

export interface RadarDataPoint {
  axis: string;
  [techno: string]: number | string;
}

const TECHNO_COLORS: Record<string, string> = {
  AC: "#3b82f6",
  IC: "#22c55e",
  RDHx: "#f97316",
  DLC: "#a855f7",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-semibold text-white mb-2">
        {payload[0]?.payload?.axis}
      </p>
      {payload.map((p: any) => (
        <div
          key={p.dataKey}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: p.stroke }}
            />
            <span className="text-white/60">{p.dataKey}</span>
          </div>
          <span className="font-mono font-semibold text-white">
            {Number(p.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function RadarCompareChart({
  data,
  technos,
}: {
  data: RadarDataPoint[];
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

  return (
    <Card className="border border-white/8 bg-white/4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
          <Target className="w-4 h-4 text-purple-400" />
          Comparaison Multicritère
        </CardTitle>
        <p className="text-xs text-white/40">
          Score normalisé 0–1 · Plus bas = meilleur sauf Densité
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart
            data={data}
            margin={{ top: 16, right: 48, left: 48, bottom: 16 }}
            outerRadius="65%"
          >
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 1]}
              tickCount={3}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
              stroke="transparent"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              formatter={(value) => (
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{value}</span>
              )}
            />
            {technos.map((techno) => (
              <Radar
                key={techno}
                name={techno}
                dataKey={techno}
                stroke={TECHNO_COLORS[techno] ?? "#94a3b8"}
                fill={TECHNO_COLORS[techno] ?? "#94a3b8"}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

export interface TcoDataPoint {
  annee: number;
  [techno: string]: number;
}

const TECHNO_COLORS: Record<string, string> = {
  AC: "#3b82f6",
  IC: "#22c55e",
  RDHx: "#f97316",
  DLC: "#a855f7",
};

function findRoiYear(data: TcoDataPoint[]): number | null {
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev.AC !== undefined && prev.IC !== undefined) {
      if (
        (prev.IC > prev.AC && curr.IC <= curr.AC) ||
        (prev.IC < prev.AC && curr.IC >= curr.AC)
      ) {
        return curr.annee;
      }
    }
  }
  return null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-white mb-2">Année {label}</p>
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
            {p.value >= 1_000_000
              ? `${(p.value / 1_000_000).toFixed(1)}M€`
              : `${(p.value / 1_000).toFixed(0)}k€`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function TcoChart({
  data,
  technos,
}: {
  data: TcoDataPoint[];
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

  const roiYear = findRoiYear(data);

  return (
    <Card className="border border-white/8 bg-white/4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Projection TCO sur 10 ans (€)
          {roiYear && (
            <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
              ROI à {roiYear} ans
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-white/40">Coût cumulé CAPEX + OPEX</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: 0, bottom: 16 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="annee"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "Années",
                position: "insideBottom",
                offset: -8,
                style: { fontSize: 11, fill: "rgba(255,255,255,0.3)" },
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(0)}M€`
                  : `${(v / 1_000).toFixed(0)}k€`
              }
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              formatter={(value) => (
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{value}</span>
              )}
            />
            {roiYear && (
              <ReferenceLine
                x={roiYear}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: "ROI",
                  position: "top",
                  fill: "#22c55e",
                  fontSize: 11,
                }}
              />
            )}
            {technos.map((techno) => (
              <Line
                key={techno}
                type="monotone"
                dataKey={techno}
                stroke={TECHNO_COLORS[techno] ?? "#94a3b8"}
                strokeWidth={2}
                dot={{ r: 3, fill: TECHNO_COLORS[techno], strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

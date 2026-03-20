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
import { Zap } from "lucide-react";

export interface EnergyDataPoint {
  techno: string;
  it: number;
  refroidissement: number;
  auxiliaires: number;
}

const COLORS = {
  it: "#3b82f6",
  refroidissement: "#f97316",
  auxiliaires: "#6b7280",
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
            <span className="text-white/60">
              {p.dataKey === "it"
                ? "Énergie IT"
                : p.dataKey === "refroidissement"
                  ? "Refroidissement"
                  : "Auxiliaires"}
            </span>
          </div>
          <span className="font-mono font-semibold text-white">
            {p.value.toLocaleString("fr-FR")} kW
          </span>
        </div>
      ))}
    </div>
  );
};

export default function EnergyChart({ data }: { data: EnergyDataPoint[] }) {
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
          <Zap className="w-4 h-4 text-yellow-400" />
          Énergie par poste (kW)
        </CardTitle>
        <p className="text-xs text-white/40">
          Décomposition IT / Refroidissement / Auxiliaires
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="techno"
              tick={{
                fontSize: 12,
                fill: "rgba(255,255,255,0.4)",
                fontWeight: 600,
              }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v.toLocaleString("fr-FR")}`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              formatter={(value) => (
                <span style={{ color: "rgba(255,255,255,0.5)" }}>
                  {value === "it"
                    ? "Énergie IT"
                    : value === "refroidissement"
                      ? "Refroidissement"
                      : "Auxiliaires"}
                </span>
              )}
            />
            <Bar dataKey="it" stackId="a" fill={COLORS.it} />
            <Bar
              dataKey="refroidissement"
              stackId="a"
              fill={COLORS.refroidissement}
            />
            <Bar
              dataKey="auxiliaires"
              stackId="a"
              fill={COLORS.auxiliaires}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

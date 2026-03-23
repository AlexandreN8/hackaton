"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingDown,
  TrendingUp,
  Zap,
  Server,
  Maximize2,
  Droplets,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  valueAC: number;
  valueIC: number;
  unit: string;
  icon: React.ReactNode;
  lowerIsBetter?: boolean;
  formatter?: (v: number) => string;
  accentColor?: string;
}

function MetricCard({
  label,
  valueAC,
  valueIC,
  unit,
  icon,
  lowerIsBetter = true,
  formatter,
  accentColor = "#3b82f6",
}: MetricCardProps) {
  const fmt = formatter ?? ((v: number) => v.toLocaleString("fr-FR"));
  const delta = valueIC - valueAC;
  const deltaPercent =
    valueAC !== 0 ? ((delta / valueAC) * 100).toFixed(1) : "0";
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  return (
    <Card className="relative overflow-hidden border border-white/8 bg-white/4 backdrop-blur-sm">
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: isNeutral
            ? "#6b7280"
            : isImprovement
              ? "#22c55e"
              : "#ef4444",
        }}
      />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
            {label}
          </span>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {icon}
          </div>
        </div>

        {/* AC → IC values */}
        <div className="flex items-end gap-2 mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-white/30 mb-0.5">AC</span>
            <span className="text-2xl font-bold tracking-tight text-white/70 font-mono">
              {fmt(valueAC)}
            </span>
          </div>

          <span className="text-white/20 text-base leading-8">→</span>

          <div className="flex flex-col">
            <span className="text-[10px] text-white/30 mb-0.5">IC</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white font-mono">
                {fmt(valueIC)}
              </span>
              <span className="text-xs text-white/40">{unit}</span>
            </div>
          </div>
        </div>

        {/* Delta */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isNeutral
              ? "bg-white/8 text-white/40"
              : isImprovement
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
          }`}
        >
          {!isNeutral &&
            (isImprovement ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            ))}
          {delta > 0 ? "+" : ""}
          {fmt(delta)} {unit}
          <span className="opacity-60">({deltaPercent}%)</span>
        </div>
      </CardContent>
    </Card>
  );
}

export interface MetricData {
  p_it_kw: number;
  nb_racks_ac: number;
  nb_racks_ic: number;
  empreinte_ac: number;
  empreinte_ic: number;
  eau_ac: number;
  eau_ic: number;
  pue_ac: number;
  pue_ic: number;
}

interface MetricCardsProps {
  data: MetricData | null;
}

export default function MetricCards({ data }: MetricCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border border-white/8 bg-white/4">
            <CardContent className="p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-20 bg-white/10 rounded" />
                <div className="h-8 w-32 bg-white/10 rounded" />
                <div className="h-5 w-24 bg-white/10 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard
        label="Puissance IT"
        valueAC={data.p_it_kw}
        valueIC={data.p_it_kw}
        unit="kW"
        icon={<Zap className="w-3.5 h-3.5" />}
        lowerIsBetter={false}
        accentColor="#f59e0b"
      />
      <MetricCard
        label="Nb. Racks"
        valueAC={data.nb_racks_ac}
        valueIC={data.nb_racks_ic}
        unit="racks"
        icon={<Server className="w-3.5 h-3.5" />}
        lowerIsBetter={true}
        accentColor="#3b82f6"
      />
      <MetricCard
        label="Empreinte Sol"
        valueAC={data.empreinte_ac}
        valueIC={data.empreinte_ic}
        unit="m²"
        icon={<Maximize2 className="w-3.5 h-3.5" />}
        lowerIsBetter={true}
        accentColor="#8b5cf6"
      />
      <MetricCard
        label="Conso. Eau / an"
        valueAC={data.eau_ac}
        valueIC={data.eau_ic}
        unit="m³"
        icon={<Droplets className="w-3.5 h-3.5" />}
        lowerIsBetter={true}
        accentColor="#06b6d4"
        formatter={(v) => v.toLocaleString("fr-FR")}
      />
    </div>
  );
}

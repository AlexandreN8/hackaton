"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HistoryEntry {
  id: number;
  created_at: string;
  techno: string;
  p_it_kw: number;
  mix_scenario: string;
  pue: number;
  e_totale_kw: number;
  co2e_annuel_t: number;
  prix_kwh: number;
}

interface HistoryTableProps {
  apiUrl: string;
  refreshTrigger?: number;
}

const MIX_LABELS: Record<string, string> = {
  fossile: "🏭 Fossile",
  nucleaire: "⚛️ Nucléaire",
  renouvelable: "🌱 Renouvelable",
  mix_france: "🇫🇷 France",
  mix_europe: "🇪🇺 Europe",
};

const TECHNO_COLORS: Record<string, string> = {
  AC: "bg-blue-100 text-blue-700 border-blue-200",
  IC: "bg-green-100 text-green-700 border-green-200",
  RDHx: "bg-orange-100 text-orange-700 border-orange-200",
  DLC: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function HistoryTable({
  apiUrl,
  refreshTrigger,
}: HistoryTableProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${apiUrl}/history`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Historique des simulations
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {history.length} simulation{history.length > 1 ? "s" : ""} enregistrée
          {history.length > 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive py-4 text-center">
            ⚠️ Impossible de charger l'historique.
          </p>
        )}
        {!error && history.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground py-4 text-center italic">
            Aucune simulation pour le moment. Lance un calcul !
          </p>
        )}
        {!error && history.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                    Techno
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                    IT (kW)
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                    Mix
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                    PUE
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                    Total (kW)
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                    CO₂e (t/an)
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                      i === 0 ? "bg-green-50/50 dark:bg-green-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground font-mono">
                      {new Date(row.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${TECHNO_COLORS[row.techno] ?? ""}`}
                      >
                        {row.techno}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.p_it_kw.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {MIX_LABELS[row.mix_scenario] ?? row.mix_scenario}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {row.pue?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.e_totale_kw?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-orange-600">
                      {row.co2e_annuel_t?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

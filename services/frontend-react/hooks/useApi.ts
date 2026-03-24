"use client";

import { useState, useEffect, useRef } from "react";

// ─── INTERFACES TYPESCRIPT ─────────────────────────────────────────────

export interface Referentiel {
  mix: { scenario: string; co2_kwh: number }[];
  technos: any;
}

export interface CalculationResult {
  techno: string;
  mix_scenario: string;
  p_it_kw: number;
  e_totale: any;
  co2e_annuel: any;
  eau_annuelle: any;
  nb_racks: any;
  e_it_pure: any;
  e_refroidissement: any;
}

export interface RTHistoryData {
  [rackId: string]: {
    [field: string]: number[];
  };
}

// ─── CONFIGURATION ─────────────────────────────────────────────────────

const API = "http://localhost:8000";

// ─── HOOKS API STANDARDS ───────────────────────────────────────────────

export function useReferentiel() {
  const [data, setData] = useState<Referentiel | null>(null);

  useEffect(() => {
    fetch(`${API}/referentiel`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Erreur serveur ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err) => console.error("Erreur Référentiel :", err));
  }, []);

  return data;
}

export function useCalculate() {
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const calculate = async (payload: any) => {
    setLoading(true);
    try {
      const d = await fetch(`${API}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      const res = d.resultats || [];
      setResults(res);
      setLoading(false);
      return res;
    } catch (e) {
      setLoading(false);
      return [];
    }
  };

  return { results, loading, calculate };
}

export function useRT(enabled: boolean) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;
    const poll = () =>
      fetch(`${API}/rt/latest`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [enabled]);

  return data;
}

export function useHistory(enabled: boolean) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;
    fetch(`${API}/history?limit=25`)
      .then((r) => r.json())
      .then((d) => setData(d.history || []))
      .catch(() => {});
  }, [enabled]);

  return data;
}

export function useStreamReco(payload: any, trigger: number) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!trigger || !payload) return;
    setText("");
    setStreaming(true);
    const ctrl = new AbortController();

    fetch(`${API}/stream-reco`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        const read = (): any =>
          reader.read().then(({ done, value }) => {
            if (done) {
              setStreaming(false);
              return;
            }
            dec
              .decode(value)
              .split("\n")
              .forEach((line) => {
                if (line.startsWith("data: ")) {
                  const d = line.slice(6);
                  if (d !== "[DONE]") setText((p) => p + d);
                }
              });
            read();
          });
        read();
      })
      .catch(() => setStreaming(false));

    return () => ctrl.abort();
  }, [trigger]);

  return { text, streaming };
}

// ─── HOOK HISTORIQUE TEMPS RÉEL (KAFKA -> COURBES) ─────────────────────

const RT_FIELDS = [
  "p_it_kw",
  "cpu_usage_percent",
  "cpu_temp_c",
  "gpu_usage_percent",
  "gpu_temp_c",
  "hbm_temp_c",
  "room_temp_c",
  "iteesv",
];
const MAX_POINTS = 1800; // 1h à 2s/point

const DB_FIELDS: Record<string, string> = {
  p_it_kw: "p_it_kw",
  cpu_usage_percent: "cpu_usage_percent",
  cpu_temp_c: "cpu_temp_c",
  gpu_usage_percent: "gpu_usage_percent",
  gpu_temp_c: "gpu_temp_c",
  hbm_temp_c: "hbm_temp_c",
  room_temp_c: "room_temp_c",
};

export function useRTHistory(enabled: boolean, rtData: any) {
  const historyRef = useRef<RTHistoryData>({});
  const [history, setHistory] = useState<RTHistoryData>({});
  const hydrated = useRef(false);

  // 1. Au montage — tente d'hydrater depuis DB
  useEffect(() => {
    if (!enabled || hydrated.current) return;
    hydrated.current = true;

    fetch(`${API}/rt/history?window=1h`)
      .then((r) => r.json())
      .then((d) => {
        const rows = d.data || [];
        if (!rows.length) return;

        const next: RTHistoryData = {};
        const seen: Record<string, boolean> = {};

        rows.forEach((row: any) => {
          const rackId = row.rack_id;
          const ts = row.timestamp_heure;
          const key = `${rackId}_${ts}`;
          if (seen[key]) return; // dédupliquer
          seen[key] = true;

          if (!next[rackId]) next[rackId] = {};
          Object.entries(DB_FIELDS).forEach(([field, dbField]) => {
            if (!next[rackId][field]) next[rackId][field] = [];
            const v = row[dbField];
            if (v != null) next[rackId][field].push(v);
          });
        });

        Object.keys(next).forEach((rackId) =>
          Object.keys(next[rackId]).forEach((field) => {
            next[rackId][field] = next[rackId][field].slice(-MAX_POINTS);
          }),
        );

        historyRef.current = next;
        setHistory({ ...next });
      })
      .catch(() => {}); // échec silencieux
  }, [enabled]);

  // 2. À chaque nouveau poll RT — ajoute en mémoire
  useEffect(() => {
    if (!rtData?.sensors) return;

    const next = { ...historyRef.current };
    Object.values(rtData.sensors).forEach((sensor: any) => {
      const id = sensor.rack_id;
      if (!next[id]) next[id] = {};
      RT_FIELDS.forEach((field) => {
        if (!next[id][field]) next[id][field] = [];
        const v = sensor[field];
        if (v != null) {
          next[id][field] = [...next[id][field], v].slice(-MAX_POINTS);
        }
      });
    });

    historyRef.current = next;
    setHistory({ ...next });
  }, [rtData]);

  return history;
}

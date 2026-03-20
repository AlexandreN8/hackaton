"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, Thermometer, Leaf, FlaskConical } from "lucide-react";

const API_URL = "http://localhost:8000";
const TECHNOS = ["AC", "IC", "RDHx", "DLC"];

export interface SimulationParams {
  technos: string[];
  p_it_kw: number;
  mix_scenario: string;
  prix_kwh: number;
}

interface SidebarProps {
  onCalculate: (params: SimulationParams) => void;
  isLoading: boolean;
}

export default function Sidebar({ onCalculate, isLoading }: SidebarProps) {
  const [selectedTechnos, setSelectedTechnos] = useState<string[]>([
    "AC",
    "IC",
  ]);
  const [pItKw, setPItKw] = useState(1000);
  const [mixScenario, setMixScenario] = useState("");
  const [prixKwh, setPrixKwh] = useState(0.15);
  const [mixList, setMixList] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/referentiel`)
      .then((r) => r.json())
      .then((data) => {
        const scenarios = data.mix.map((m: { scenario: string }) => m.scenario);
        setMixList(scenarios);
        if (scenarios.length > 0) setMixScenario(scenarios[0]);
      })
      .catch(() => {
        const fallback = [
          "Mix Renouvelable",
          "Mix Nucléaire pur",
          "Mix Décarboné",
          "Mix Moyen",
          "États-Unis",
          "Mix Fossile",
        ];
        setMixList(fallback);
        setMixScenario(fallback[0]);
      });
  }, []);

  const toggleTechno = (techno: string) => {
    setSelectedTechnos((prev) =>
      prev.includes(techno)
        ? prev.length > 1
          ? prev.filter((t) => t !== techno)
          : prev
        : [...prev, techno],
    );
  };

  const handleSubmit = () => {
    if (!mixScenario) return;
    onCalculate({
      technos: selectedTechnos,
      p_it_kw: pItKw,
      mix_scenario: mixScenario,
      prix_kwh: prixKwh,
    });
  };

  return (
    <aside className="w-72 min-h-screen bg-card border-r border-border flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 py-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Thermometer className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">
            Cooling Comparator
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hackathon Cisco
          </p>
        </div>
      </div>

      <Separator />

      <Card className="border-0 shadow-none bg-muted/40">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            Technologies
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-wrap gap-2">
            {TECHNOS.map((techno) => (
              <button
                key={techno}
                onClick={() => toggleTechno(techno)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                  selectedTechnos.includes(techno)
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {techno}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {selectedTechnos.length} sélectionnée
            {selectedTechnos.length > 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-muted/40">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Charge IT
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Puissance</span>
            <Badge variant="secondary" className="font-mono font-semibold">
              {pItKw.toLocaleString("fr-FR")} kW
            </Badge>
          </div>
          <Slider
            min={100}
            max={5000}
            step={100}
            value={[pItKw]}
            onValueChange={(v) => setPItKw(v[0])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>100 kW</span>
            <span>5 000 kW</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-muted/40">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" />
            Mix Électrique
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Select value={mixScenario} onValueChange={setMixScenario}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chargement..." />
            </SelectTrigger>
            <SelectContent>
              {mixList.map((mix) => (
                <SelectItem key={mix} value={mix}>
                  {mix}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-muted/40">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prix électricité
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">€/kWh</span>
            <Badge variant="secondary" className="font-mono font-semibold">
              {prixKwh.toFixed(2)} €
            </Badge>
          </div>
          <Slider
            min={0.05}
            max={0.5}
            step={0.01}
            value={[prixKwh]}
            onValueChange={(v) => setPrixKwh(v[0])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.05 €</span>
            <span>0.50 €</span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button
        onClick={handleSubmit}
        disabled={isLoading || !mixScenario}
        className="w-full font-semibold"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Calcul en cours...
          </span>
        ) : (
          "🚀 Lancer le calcul"
        )}
      </Button>
    </aside>
  );
}

"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export interface HypothesisData {
  techno: string;
  perimetre_inclus: string;
  perimetre_exclus?: string;
  hypothese: string;
  source: string;
}

interface HypothesesProps {
  data: HypothesisData[];
}

const TECHNO_COLORS: Record<string, string> = {
  AC: "bg-blue-100 text-blue-700 border-blue-200",
  IC: "bg-green-100 text-green-700 border-green-200",
  RDHx: "bg-orange-100 text-orange-700 border-orange-200",
  DLC: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function Hypotheses({ data }: HypothesesProps) {
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          Périmètre & Hypothèses
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Détail des inclusions, exclusions et sources par technologie
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-1">
          {data.map((item) => (
            <AccordionItem
              key={item.techno}
              value={item.techno}
              className="border rounded-lg px-3"
            >
              <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${TECHNO_COLORS[item.techno] ?? ""}`}
                  >
                    {item.techno}
                  </Badge>
                  <span className="text-muted-foreground font-normal truncate max-w-xs">
                    {item.hypothese.slice(0, 60)}…
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">
                      ✅ Périmètre inclus :{" "}
                    </span>
                    <span className="text-muted-foreground">
                      {item.perimetre_inclus}
                    </span>
                  </div>
                  {item.perimetre_exclus && (
                    <div>
                      <span className="font-medium text-foreground">
                        ❌ Périmètre exclus :{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {item.perimetre_exclus}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-foreground">
                      💡 Hypothèse :{" "}
                    </span>
                    <span className="text-muted-foreground">
                      {item.hypothese}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      📚 Source :{" "}
                    </span>
                    <span className="text-muted-foreground text-xs font-mono">
                      {item.source}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

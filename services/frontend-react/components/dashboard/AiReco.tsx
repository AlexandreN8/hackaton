"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, CircleCheck } from "lucide-react";

interface AiRecoProps {
  payload: object | null;
  apiUrl: string;
}

type Status = "idle" | "loading" | "streaming" | "done" | "error";

export default function AiReco({ payload, apiUrl }: AiRecoProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!payload) return;

    setText("");
    setStatus("loading");

    const controller = new AbortController();

    const run = async () => {
      try {
        const res = await fetch(`${apiUrl}/stream-reco`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("No body");

        setStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE format: lines starting with "data:"
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const content = line.replace(/^data:\s?/, "");
              if (content && content !== "[DONE]") {
                setText((prev) => prev + content + " ");
              }
            }
          }
        }

        setStatus("done");
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setStatus("error");
        }
      }
    };

    run();
    return () => controller.abort();
  }, [payload, apiUrl]);

  // Auto-scroll as text streams in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-500" />
            Analyse & Recommandation IA
          </CardTitle>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-muted-foreground">
          Générée en temps réel par le backend Anthropic
        </p>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="min-h-[120px] max-h-[220px] overflow-y-auto rounded-lg bg-muted/40 p-4 text-sm leading-relaxed"
        >
          {status === "idle" && (
            <p className="text-muted-foreground italic">
              Lance un calcul pour obtenir une recommandation IA…
            </p>
          )}
          {status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Connexion au service IA…
            </div>
          )}
          {(status === "streaming" || status === "done") && (
            <p className="whitespace-pre-wrap">
              {text}
              {status === "streaming" && (
                <span className="inline-block w-2 h-4 bg-violet-500 animate-pulse ml-0.5 rounded-sm" />
              )}
            </p>
          )}
          {status === "error" && (
            <p className="text-destructive">
              ⚠️ Impossible de se connecter au service IA. Vérifie que le
              backend tourne.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "idle") return null;
  if (status === "loading" || status === "streaming")
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        En cours…
      </Badge>
    );
  if (status === "done")
    return (
      <Badge variant="default" className="gap-1 text-xs bg-green-600">
        <CircleCheck className="w-3 h-3" />
        Terminé
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive" className="text-xs">
        Erreur
      </Badge>
    );
  return null;
}

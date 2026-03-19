# Service IA — génère une recommandation en langage naturel
# à partir des résultats du calculator.
# Streame la réponse token par token via SSE.

import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic

app    = FastAPI(title="Hackathon Cisco — Service IA")
client = Anthropic(api_key=os.getenv("LLM_API_KEY", ""))


class RecoRequest(BaseModel):
    resultats: list[dict]
    p_it_kw: float


def build_prompt(resultats: list[dict], p_it_kw: float) -> str:
    lines = [f"Charge IT analysée : {p_it_kw} kW\n"]
    for r in resultats:
        roi = f"ROI={r['roi_ans']:.1f} ans" if r["roi_ans"] else "référence"
        lines.append(
            f"- {r['techno']} × {r['mix']} : "
            f"E={r['e_totale_kw']} kW, CO2e={r['co2e_tco2']} tCO2e/an, "
            f"Eau={r['eau_m3']} m³/an, Racks={r['nb_racks']}, {roi}"
        )
    lines.append(
        "\nTu es un expert en infrastructure datacenter. "
        "En 3-4 phrases concises, compare objectivement l'Immersion Cooling (IC) "
        "et l'Air Cooling (AC) sur ces résultats. "
        "Mentionne l'impact CO2e selon le mix électrique, le ROI et la densité. "
        "Sois factuel et neutre."
    )
    return "\n".join(lines)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/recommend")
async def recommend(req: RecoRequest):
    prompt = build_prompt(req.resultats, req.p_it_kw)

    def generate():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

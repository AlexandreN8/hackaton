from fastapi import FastAPI

app = FastAPI(title="Hackathon Cisco — Service IA")

@app.get("/health")
def health():
    return {"status": "ok"}

# TODO : implémenter la recommandation LLM

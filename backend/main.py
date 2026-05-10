from fastapi import FastAPI

app = FastAPI(title="Lumina API", version="1.0.0")

@app.get('/')
def root():
    return {'message': 'Lumina Backend is live'}
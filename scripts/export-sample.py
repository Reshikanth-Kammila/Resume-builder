"""Export the actual saved personal master, then retain its validation report."""

import json
from pathlib import Path

import httpx

output = Path("output/pdf").resolve()
output.mkdir(parents=True, exist_ok=True)
with httpx.Client(base_url="http://127.0.0.1:8000", timeout=60, trust_env=False) as client:
    response = client.post("/api/exports", json={})
    response.raise_for_status()
    exported = response.json()
    download = client.get(exported["download_url"])
    download.raise_for_status()
    target = output / "Reshikanth_Kammila_Resume_Studio.pdf"
    target.write_bytes(download.content)
    (output / "validation.json").write_text(json.dumps(exported, indent=2), encoding="utf-8")
print(json.dumps({"path": str(target), "validation": exported["validation"]}))

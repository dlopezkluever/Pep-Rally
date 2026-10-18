"""Small, unauthenticated API availability probes; not scientific evidence extraction.

Run: python scripts/probe_sources.py
Writes research/api-probes.json. Uses only Python's standard library.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

PROBES = {
    "pubmed_search": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=elamipretide&retmax=2&retmode=json&tool=peppy_tides_phase0",
    "pubmed_fetch": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=29718389&retmode=xml&tool=peppy_tides_phase0",
    "clinicaltrials": "https://clinicaltrials.gov/api/v2/studies?query.intr=elamipretide&pageSize=1&format=json",
    "pubchem": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/oxytocin/property/MolecularFormula,MolecularWeight,InChIKey/JSON",
    "iuphar": "https://www.guidetopharmacology.org/services/ligands?name=oxytocin",
    "openfda": "https://api.fda.gov/drug/drugsfda.json?search=products.active_ingredients.name:%22BREMELANOTIDE%22&limit=1",
    "rcsb": "https://data.rcsb.org/rest/v1/core/entry/1AON",
    "uniprot": "https://rest.uniprot.org/uniprotkb/P01178.json",
}


def probe(item):
    name, url = item
    record = {"name": name, "url": url, "retrieved_at": datetime.now(timezone.utc).isoformat()}
    req = urllib.request.Request(url, headers={"User-Agent": "PeppyTides-Phase0/0.1", "Accept": "application/json,application/xml;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            body = response.read(2_000_000)
            record.update(status=response.status, content_type=response.headers.get("Content-Type"), final_url=response.url)
            record["response_headers"] = {k: v for k, v in response.headers.items() if k.lower() in {"retry-after", "x-uniprot-release", "x-uniprot-release-date", "last-modified", "x-throttling-control"}}
        record.update(bytes_read=len(body), sha256=hashlib.sha256(body).hexdigest())
        if "json" in record.get("content_type", ""):
            obj = json.loads(body)
            record["top_level_keys"] = sorted(obj) if isinstance(obj, dict) else []
            if name == "pubmed_search":
                record["evidence"] = obj.get("esearchresult")
            elif name == "clinicaltrials":
                study = obj.get("studies", [{}])[0]
                record["evidence"] = {"study_keys": sorted(study), "identification": study.get("protocolSection", {}).get("identificationModule"), "hasResults": study.get("hasResults")}
            elif name == "pubchem":
                record["evidence"] = obj.get("PropertyTable")
            elif name == "openfda":
                result = obj.get("results", [{}])[0]
                record["evidence"] = {"application_number": result.get("application_number"), "result_keys": sorted(result), "meta": obj.get("meta")}
            elif name == "uniprot":
                record["evidence"] = {"primaryAccession": obj.get("primaryAccession"), "entryType": obj.get("entryType"), "organism": obj.get("organism", {}).get("scientificName"), "sequence_length": obj.get("sequence", {}).get("length"), "cross_reference_databases": sorted({x["database"] for x in obj.get("uniProtKBCrossReferences", [])})}
            elif name == "rcsb":
                record["evidence"] = {"rcsb_id": obj.get("rcsb_id"), "identifier_keys": sorted(obj.get("rcsb_entry_container_identifiers", {}))}
            else:
                record["evidence"] = {"array_length": len(obj)} if isinstance(obj, list) else obj
        elif name == "pubmed_fetch":
            root = ET.fromstring(body)
            record["evidence"] = {"root": root.tag, "pmid": root.findtext(".//PMID"), "abstract_present": root.find(".//Abstract") is not None, "full_text_body_present": root.find(".//body") is not None}
        else:
            record["evidence"] = {"response_prefix": body.decode("utf-8", errors="replace")[:180]}
    except urllib.error.HTTPError as error:
        record.update(status=error.code, error_type="HTTPError", response_prefix=error.read(500).decode("utf-8", errors="replace"))
    except Exception as error:
        record.update(status=None, error_type=type(error).__name__, error=str(error)[:200])
    return record


def main():
    # One sequential request per host; this small run remains below documented limits.
    observations = []
    for item in PROBES.items():
        observations.append(probe(item))
        time.sleep(0.4)
    output = Path(__file__).resolve().parents[1] / "research" / "api-probes.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"purpose": "Transport/schema smoke observations, not verified scientific claims", "observations": observations}, indent=2) + "\n", encoding="utf-8")
    for item in observations:
        print(item["name"], item.get("status"), item.get("error_type", "ok"))


if __name__ == "__main__":
    main()

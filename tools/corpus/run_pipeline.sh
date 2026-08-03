#!/bin/bash
# Usage: ./run_pipeline.sh <step>
# Steps: fetch | enrich | gaps | merge | emit | help
#
# The LLM steps are Claude Code skills, interleaved between deterministic steps:
#
#   ./run_pipeline.sh fetch    # 1. Tatoeba API → raw/
#   /corpus-enrich             # 2. raw/ → work/enrichment.jsonl  (LLM)
#   ./run_pipeline.sh enrich   # 3. join + validate → enriched/
#   ./run_pipeline.sh gaps     # 4. compute gaps → work/gaps.json
#   /corpus-gapfill            # 5. gaps → work/gapfill-cards.jsonl (LLM)
#   ./run_pipeline.sh merge    # 6. validate + append → enriched/
#   ./run_pipeline.sh emit     # 7. partition + hash → docs/

set -e
cd "$(dirname "$0")/../.."

case "${1:-help}" in
  fetch)
    node tools/corpus/fetch_tatoeba.js
    ;;
  enrich)
    if [ ! -f tools/corpus/work/enrichment.jsonl ]; then
      echo "ERROR: tools/corpus/work/enrichment.jsonl not found." >&2
      echo "Run the /corpus-enrich skill to produce it." >&2
      exit 1
    fi
    node tools/corpus/enrich.js
    ;;
  gaps)
    node tools/corpus/gapfill.js
    ;;
  merge)
    if [ ! -f tools/corpus/work/gapfill-cards.jsonl ]; then
      echo "ERROR: tools/corpus/work/gapfill-cards.jsonl not found." >&2
      echo "Run the /corpus-gapfill skill to produce it." >&2
      exit 1
    fi
    node tools/corpus/merge_gapfill.js
    ;;
  emit)
    node tools/corpus/emit_chunks.js
    ;;
  help|*)
    cat <<EOF
Corpus pipeline. The LLM steps are skills, run between deterministic steps:

  ./run_pipeline.sh fetch    # 1. Tatoeba API → raw/
  /corpus-enrich             # 2. raw/ → work/enrichment.jsonl  (LLM)
  ./run_pipeline.sh enrich   # 3. join + validate → enriched/
  ./run_pipeline.sh gaps     # 4. compute gaps → work/gaps.json
  /corpus-gapfill            # 5. gaps → work/gapfill-cards.jsonl (LLM)
  ./run_pipeline.sh merge    # 6. validate + append → enriched/
  ./run_pipeline.sh emit     # 7. partition + hash → docs/

Each deterministic step is independently re-runnable.
EOF
    ;;
esac

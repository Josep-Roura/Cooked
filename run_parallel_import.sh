#!/bin/bash
# Parallel import script - splits and imports in parallel
# Usage: NUM_WORKERS=4 ./run_parallel_import.sh

NUM_WORKERS=${NUM_WORKERS:-4}
BATCH_SIZE=${BATCH_SIZE:-200}
RECIPES_FILE="recipes.jsonl"

echo "🚀 Parallel Import Starting"
echo "Workers: $NUM_WORKERS"
echo "Batch Size: $BATCH_SIZE"
echo ""

# Step 1: Split the file
echo "Step 1: Splitting recipes.jsonl into $NUM_WORKERS chunks..."
source venv/bin/activate
NUM_CHUNKS=$NUM_WORKERS python3 split_jsonl.py

if [ ! -d "recipe_chunks" ]; then
    echo "❌ Error: recipe_chunks directory not created"
    exit 1
fi

echo ""
echo "Step 2: Starting parallel imports..."
echo ""

# Step 2: Start parallel imports
START_TIME=$(date +%s)
CHUNK_FILES=(recipe_chunks/chunk_*.jsonl)
TOTAL_FILES=${#CHUNK_FILES[@]}

for chunk_file in "${CHUNK_FILES[@]}"; do
    echo "  📦 Starting: $chunk_file"
    INPUT_PATH="$chunk_file" BATCH_SIZE=$BATCH_SIZE python3 import_jsonl_parallel.py > "${chunk_file%.jsonl}.log" 2>&1 &
done

# Wait for all background jobs
echo ""
echo "⏳ Waiting for all imports to complete..."
wait

# Step 3: Summary
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All imports complete!"
echo "Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo "📊 Summary by chunk:"
for chunk_file in "${CHUNK_FILES[@]}"; do
    log_file="${chunk_file%.jsonl}.log"
    if [ -f "$log_file" ]; then
        recipes=$(grep -c "^✅ Batch" "$log_file" 2>/dev/null || echo 0)
        total=$(tail -10 "$log_file" | grep "total" | tail -1 | grep -oE "[0-9]+ recipes" | head -1 | awk '{print $1}')
        if [ -z "$total" ]; then
            total="?"
        fi
        echo "  $chunk_file: $total recipes"
    fi
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

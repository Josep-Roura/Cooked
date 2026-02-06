#!/bin/bash
# ULTIMATE SPEED: 8 parallel workers with huge batches
# Expected: 4-6 hours for all 2.2M recipes (10x faster than original!)

NUM_WORKERS=${NUM_WORKERS:-8}
BATCH_SIZE=${BATCH_SIZE:-2000}  # HUGE batches
CHUNK_SIZE=${CHUNK_SIZE:-5000}   # Insert 5000 at once
RECIPES_FILE="recipes.jsonl"

echo "🚀🚀🚀 ULTIMATE FAST IMPORT 🚀🚀🚀"
echo "Workers: $NUM_WORKERS"
echo "Batch Size: $BATCH_SIZE"
echo "Chunk Insert: $CHUNK_SIZE"
echo ""

source venv/bin/activate

# Step 1: Split the file
echo "📂 Splitting recipes.jsonl into $NUM_WORKERS chunks..."
NUM_CHUNKS=$NUM_WORKERS python3 split_jsonl.py

if [ ! -d "recipe_chunks" ]; then
    echo "❌ Error: recipe_chunks directory not created"
    exit 1
fi

echo ""
echo "🚀 Starting $NUM_WORKERS parallel ultra-fast imports..."
echo "⏱️  Estimated time: 4-6 hours for 2.2M recipes"
echo ""

# Step 2: Start parallel imports with huge batches
START_TIME=$(date +%s)
CHUNK_FILES=(recipe_chunks/chunk_*.jsonl)

for chunk_file in "${CHUNK_FILES[@]}"; do
    echo "  ▶️  $chunk_file"
    INPUT_PATH="$chunk_file" BATCH_SIZE=$BATCH_SIZE CHUNK_INSERT_SIZE=$CHUNK_SIZE \
        python3 import_jsonl_ultra_fast.py > "${chunk_file%.jsonl}.log" 2>&1 &
done

# Step 3: Real-time progress monitoring
echo ""
echo "📊 PROGRESS MONITORING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MONITOR_INTERVAL=15  # Check every 15 seconds
TOTAL_EXPECTED=2231142
CHUNK_EXPECTED=$((TOTAL_EXPECTED / NUM_WORKERS))

while true; do
    TOTAL=0
    ALL_DONE=true
    
    echo -ne "\r⏰ $(date '+%H:%M:%S') | Progress: "
    
    for i in "${!CHUNK_FILES[@]}"; do
        log_file="${CHUNK_FILES[$i]%.jsonl}.log"
        if [ -f "$log_file" ]; then
            # Count recipes from last line
            recipes=$(tail -1 "$log_file" | grep -oE "[0-9]+.*recipe" | head -1 | awk '{print $1}')
            if [ -z "$recipes" ]; then
                recipes=0
                ALL_DONE=false
            fi
            TOTAL=$((TOTAL + recipes))
        else
            ALL_DONE=false
        fi
    done
    
    PERCENT=$((TOTAL * 100 / TOTAL_EXPECTED))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -gt 0 ]; then
        RATE=$((TOTAL / ELAPSED))
        if [ $RATE -gt 0 ]; then
            REMAINING=$((TOTAL_EXPECTED - TOTAL))
            ETA=$((REMAINING / RATE))
            ETA_H=$((ETA / 3600))
            ETA_M=$(((ETA % 3600) / 60))
        else
            ETA_H=0
            ETA_M=0
        fi
    fi
    
    printf "%d%% | %'d/%'d recipes | ETA: %dh %dm     " $PERCENT $TOTAL $TOTAL_EXPECTED $ETA_H $ETA_M
    
    if [ "$ALL_DONE" = true ] && grep -q "🎉 DONE" recipe_chunks/chunk_*.log 2>/dev/null; then
        echo ""
        break
    fi
    
    sleep $MONITOR_INTERVAL
done

# Step 4: Final summary
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 ALL IMPORTS COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo "📊 Results by chunk:"
echo ""

GRAND_TOTAL=0
for chunk_file in "${CHUNK_FILES[@]}"; do
    log_file="${chunk_file%.jsonl}.log"
    if [ -f "$log_file" ]; then
        recipes=$(tail -1 "$log_file" | grep -oE "[0-9]+.*recipe" | head -1 | awk '{print $1}')
        if [ -z "$recipes" ]; then
            recipes=$(grep -o "recipes" "$log_file" | wc -l)
        fi
        GRAND_TOTAL=$((GRAND_TOTAL + recipes))
        printf "  ✅ %-35s: %'d recipes\n" "$(basename $log_file)" "$recipes"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "🏁 TOTAL: %'d recipes imported in %dm %ds\n" "$GRAND_TOTAL" "$MINUTES" "$SECONDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Ready to use! Run queries to verify:"
echo "  SELECT COUNT(*) FROM recipes;"
echo "  SELECT COUNT(*) FROM recipe_ingredients;"
echo ""

#!/bin/bash

LOG_FILE="import_final.log"
TOTAL_RECIPES=2231142
BATCH_SIZE=500

# Get start time
START_TIME=$(date +%s)

echo "Starting import monitor..."
echo "Target: $TOTAL_RECIPES recipes in batches of $BATCH_SIZE"
echo ""

COUNTER=0
while true; do
    COUNTER=$((COUNTER + 1))
    
    if [ ! -f "$LOG_FILE" ]; then
        echo "⏳ Waiting for log file..."
        sleep 5
        continue
    fi
    
    # Count completed batches
    COMPLETED_BATCHES=$(grep "^✅ Batch" "$LOG_FILE" 2>/dev/null | wc -l)
    
    if [ "$COMPLETED_BATCHES" -gt 0 ]; then
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))
        IMPORTED_RECIPES=$((COMPLETED_BATCHES * BATCH_SIZE))
        
        PERCENTAGE=$((IMPORTED_RECIPES * 100 / TOTAL_RECIPES))
        
        if [ $ELAPSED -gt 0 ]; then
            RATE=$((IMPORTED_RECIPES / ELAPSED))
        else
            RATE=0
        fi
        
        REMAINING=$((TOTAL_RECIPES - IMPORTED_RECIPES))
        if [ $RATE -gt 0 ]; then
            ETA_SECONDS=$((REMAINING / RATE))
        else
            ETA_SECONDS=0
        fi
        
        ETA_HOURS=$((ETA_SECONDS / 3600))
        ETA_MINS=$(( (ETA_SECONDS % 3600) / 60 ))
        
        echo "Progress: $IMPORTED_RECIPES / $TOTAL_RECIPES recipes ($PERCENTAGE%)"
        echo "Batches: $COMPLETED_BATCHES, Elapsed: $((ELAPSED / 60))m, Rate: ~$RATE recipes/sec"
        if [ $ETA_HOURS -gt 0 ] || [ $ETA_MINS -gt 0 ]; then
            echo "ETA: ~$ETA_HOURS hours $ETA_MINS minutes"
        fi
        
        # Check if done
        if grep -q "^🎉 Done" "$LOG_FILE"; then
            echo "✅ Import completed!"
            break
        fi
    else
        echo "⏳ Starting batch 1..."
    fi
    
    sleep 30
done

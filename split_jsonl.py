#!/usr/bin/env python3
"""
Split recipes.jsonl into multiple chunks for parallel import.
"""
import os
import sys

INPUT_PATH = os.getenv("INPUT_PATH", "recipes.jsonl")
NUM_CHUNKS = int(os.getenv("NUM_CHUNKS", "4"))
OUTPUT_DIR = "recipe_chunks"

def count_lines(filepath):
    """Count lines in file efficiently."""
    count = 0
    with open(filepath, 'rb') as f:
        for _ in f:
            count += 1
    return count

def split_file(input_path, num_chunks, output_dir):
    """Split JSONL file into chunks."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    print(f"Counting lines in {input_path}...", flush=True)
    total_lines = count_lines(input_path)
    lines_per_chunk = (total_lines + num_chunks - 1) // num_chunks
    
    print(f"Total lines: {total_lines}", flush=True)
    print(f"Lines per chunk: {lines_per_chunk}", flush=True)
    print(f"Creating {num_chunks} chunks...", flush=True)
    
    chunk_files = []
    current_chunk = 0
    current_file = None
    current_count = 0
    
    with open(input_path, 'r') as f:
        for line_no, line in enumerate(f, 1):
            # Open new chunk file if needed
            if current_count == 0:
                if current_file:
                    current_file.close()
                chunk_path = os.path.join(output_dir, f"chunk_{current_chunk:03d}.jsonl")
                current_file = open(chunk_path, 'w')
                chunk_files.append(chunk_path)
                print(f"  Creating {chunk_path}...", flush=True)
            
            # Write line to current chunk
            current_file.write(line)
            current_count += 1
            
            # Move to next chunk if this one is full
            if current_count >= lines_per_chunk and current_chunk < num_chunks - 1:
                current_chunk += 1
                current_count = 0
            
            if line_no % 100000 == 0:
                print(f"  Processed {line_no:,} lines ({current_chunk + 1}/{num_chunks})...", flush=True)
    
    if current_file:
        current_file.close()
    
    print(f"✅ Created {len(chunk_files)} chunks", flush=True)
    for chunk_path in chunk_files:
        lines = count_lines(chunk_path)
        size_mb = os.path.getsize(chunk_path) / (1024 * 1024)
        print(f"  {chunk_path}: {lines:,} recipes ({size_mb:.1f} MB)")
    
    return chunk_files

if __name__ == "__main__":
    if not os.path.exists(INPUT_PATH):
        print(f"Error: {INPUT_PATH} not found")
        sys.exit(1)
    
    chunk_files = split_file(INPUT_PATH, NUM_CHUNKS, OUTPUT_DIR)
    
    print("\n✅ Split complete!")
    print(f"\nRun parallel imports with:")
    for i, chunk_file in enumerate(chunk_files):
        print(f"  INPUT_PATH={chunk_file} BATCH_SIZE=1000 python3 import_jsonl.py &")
    print("\nWait for all to complete, then run:")
    print("  wait  # Wait for all background jobs")

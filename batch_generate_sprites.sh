#!/bin/bash

# Batch generate sprite sheets for all UR units without sheets

UNITS=(
  "ur_celestial_cat"
  "ur_chrono_sage"
  "ur_chronos_cat"
  "ur_crystal_griffin"
  "ur_emerald_dragon"
  "ur_fire_lotus_cat"
  "ur_galaxy_butterfly"
  "ur_golden_lion"
  "ur_inferno_demon"
  "ur_jade_dragon"
  "ur_nature_spirit_cat"
  "ur_nature_titan"
  "ur_prismatic_cat"
  "ur_rose_capybara"
  "ur_rose_queen"
  "ur_rune_golem"
  "ur_sea_leviathan"
  "ur_stone_golem_cat"
  "ur_thunder_phoenix"
)

total=${#UNITS[@]}
current=0

for unit in "${UNITS[@]}"; do
  current=$((current + 1))
  echo ""
  echo "=========================================="
  echo "[$current/$total] Processing: $unit"
  echo "=========================================="

  input="public/assets/sprites/${unit}.png"
  output="public/assets/sprites/${unit}_sheet.png"

  if [[ -f "$output" ]]; then
    echo "Sheet already exists, skipping..."
    continue
  fi

  echo "Step 1: Generating sprite sheet..."
  node generate_sprite.js "$input" "$output"

  if [[ -f "$output" ]]; then
    echo "Step 2: Removing background..."
    node remove_bg.js "$output"
    echo "Done: $unit"
  else
    echo "ERROR: Failed to generate $unit"
  fi
done

echo ""
echo "=========================================="
echo "Batch processing complete!"
echo "=========================================="

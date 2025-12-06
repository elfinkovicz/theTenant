#!/bin/bash
# Build Lambda Packages für Stream Restreaming

echo "Building Lambda packages..."

# Erstelle temporäres Verzeichnis
TEMP_DIR="temp_build"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Build lambda.zip (API Handler)
echo "Building lambda.zip..."
cp lambda/index.py "$TEMP_DIR/index.py"
cd "$TEMP_DIR"
zip -q ../lambda.zip index.py
cd ..

# Build monitor.zip (Stream Monitor)
echo "Building monitor.zip..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cp lambda/stream_monitor.py "$TEMP_DIR/stream_monitor.py"
cp lambda/index.py "$TEMP_DIR/index.py"
cd "$TEMP_DIR"
zip -q ../monitor.zip stream_monitor.py index.py
cd ..

# Cleanup
rm -rf "$TEMP_DIR"

echo "Lambda packages built successfully!"
echo "  - lambda.zip (API Handler)"
echo "  - monitor.zip (Stream Monitor)"

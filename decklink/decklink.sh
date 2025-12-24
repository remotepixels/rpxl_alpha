#!/bin/zsh

FFMPEG="./ffmpeg-dl"

echo "Scanning DeckLink output devices..."

DEVICES_RAW="$($FFMPEG -sinks decklink 2>&1 | grep '\[')"

# Extract names
devices=()
while IFS= read -r line; do
    name="$(echo "$line" | sed -n 's/.*\[\(.*\)\].*/\1/p')"
    [[ -n "$name" ]] && devices+=("$name")
done <<< "$DEVICES_RAW"

echo ""
echo "DEBUG: device count = ${#devices[@]}"
echo ""

if (( ${#devices[@]} == 0 )); then
    echo "No devices found."
    exit 1
fi

echo "Detected Devices:"
i=1
for d in "${devices[@]}"; do
    echo "  $i) $d"
    ((i++))
done

echo ""
echo -n "Enter number: "
read choice

echo "DEBUG: you typed [$choice]"

index=$((choice - 1))

echo "DEBUG: index = $index"
echo "DEBUG: devices[$index] = [${devices[$index]}]"

DEVICE="${devices[$index]}"

echo ""
echo "FINAL DEVICE = [$DEVICE]"

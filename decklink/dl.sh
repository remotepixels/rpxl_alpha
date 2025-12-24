#!/bin/zsh

FFMPEG="./ffmpeg-dl"

# ────────────────────────────────────────────────
# Menu helper (pure zsh, no colors)
# ────────────────────────────────────────────────
prompt_menu() {
    local __outvar="$1"
    local prompt="$2"
    shift 2
    local arr=("$@")
    local choice

    echo "" >&2
    echo "$prompt" >&2

    local i=1
    for item in "${arr[@]}"; do
        echo "  $i) $item" >&2
        ((i++))
    done

    while true; do
        echo -n "Enter number: " >&2
        read choice < /dev/tty
        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#arr[@]} )); then
            # assign by name (NO subshell)
            eval "$__outvar=\"\${arr[$choice]}\""
            return 0
        else
            echo "Invalid choice. Try again." >&2
        fi
    done
}

# ────────────────────────────────────────────────
# 1) Get VDO.Ninja URL
# ────────────────────────────────────────────────
echo "Paste your VDO.Ninja URL:"
read -r NINJA_URL

if [[ ! "$NINJA_URL" =~ '^(https?://)' ]]; then
    echo "Invalid URL. Must start with http:// or https://"
    exit 1
fi

# ────────────────────────────────────────────────
# 2) Detect DeckLink devices
# ────────────────────────────────────────────────
echo ""
echo "Scanning DeckLink output devices..."

DEVICES_RAW="$($FFMPEG -sinks decklink 2>&1 | grep '\[')"

devices=("${(@f)$(echo "$DEVICES_RAW" | sed -n 's/.*\[\(.*\)\].*/\1/p')}")

if (( ${#devices[@]} == 0 )); then
    echo "No DeckLink devices found."
    exit 1
fi

prompt_menu DEVICE "Detected Devices:" "${devices[@]}"

# printf 'DEBUG DEVICE=[%s]\n' "$DEVICE"

echo "Selected device: $DEVICE"

# ────────────────────────────────────────────────
# 3) Detect supported video modes
# ────────────────────────────────────────────────
echo ""
echo "Querying supported video modes..."

# Query supported modes
MODES_RAW="$(
  $FFMPEG \
    -f lavfi -i color=size=1920x1080:rate=25 \
    -f decklink -list_formats 1 "$DEVICE" 2>&1
)"

# Extract unique resolutions
resolutions=($(echo "$MODES_RAW" | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+x[0-9]+$/) print $i}' | sort -u))

# --- Resolution selection ---
echo "Supported resolutions:"
i=1
for res in "${resolutions[@]}"; do
    echo "  $i) $res"
    ((i++))
done

echo -n "Enter number: "
read res_choice
RES="${resolutions[$((res_choice))]}"
echo "Selected resolution: $RES"

# Extract frame rates for that resolution
fps_lines=($(echo "$MODES_RAW" | grep "$RES" | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\/[0-9]+$/) print $i}'))
fps_unique=($(printf "%s\n" "${fps_lines[@]}" | sort -u))

# --- Frame rate selection ---
echo "Supported frame rates for $RES:"
i=1
for f in "${fps_unique[@]}"; do
    echo "  $i) $f fps"
    ((i++))
done

echo -n "Enter number: "
read fps_choice
FPS="${fps_unique[$((fps_choice))]}"
echo "Selected frame rate: $FPS"


# ────────────────────────────────────────────────
# Final confirmation
# ────────────────────────────────────────────────
echo ""
echo "Final configuration:"
echo " URL        : $NINJA_URL"
echo " Device     : $DEVICE"
echo " Resolution : $RES"
echo " Frame rate : $FPS"
echo ""

# ffmpeg command
cmd=(
  "$FFMPEG"
  -re
  -i "$NINJA_URL"
  -pix_fmt uyvy422
  -f decklink
  -s "$RES"
  -r "$FPS"
  "$DEVICE"
)

echo "Running command:"
printf ' %q' "${cmd[@]}"
echo

"${cmd[@]}"



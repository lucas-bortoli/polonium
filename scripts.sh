#!/usr/bin/false

build() {
    tsc
}

run() {
    SCRIPT_PATH=$(dirname "$0")
    SCRIPT_PATH=$(cd "$SCRIPT_PATH" && pwd)

    cd "$SCRIPT_PATH"
    node -r dotenv/config dist/index.js
}
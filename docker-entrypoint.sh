#!/bin/bash

# Processes
/pb/pocketbase serve "--http=0.0.0.0:8000" --automigrate &
PORT=8080 DB_URL="http://0.0.0.0:8000" pnpm run start &

# Wait for any process to exit, return its exit code
wait -n
exit $?

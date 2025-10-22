#!/bin/sh
set -e

# The base command to run is passed as arguments to this script from the Dockerfile CMD.
# e.g., "python", "server.py"
base_command="$@"

# Default port is 8000 if the PORT environment variable is not set.
port_arg=${PORT:-8000}

# Start building the final command arguments
final_command_args="$port_arg"

# Add the --demo flag if the DEMO_MODE environment variable is set to "true"
if [ "$DEMO_MODE" = "true" ]; then
  final_command_args="$final_command_args --demo"
fi

# Execute the base command with the constructed arguments.
# This will expand to something like: exec python server.py 8000 --demo
exec $base_command $final_command_args

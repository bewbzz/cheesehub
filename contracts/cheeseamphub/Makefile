# Makefile for cheeseamphub contract
# Requires EOSIO CDT (Contract Development Toolkit) to be installed

# Contract name
CONTRACT = cheeseamphub

# CDT paths (adjust if needed)
CDT_PREFIX ?= /usr/local/eosio.cdt

# Compiler and linker
CC = $(CDT_PREFIX)/bin/eosio-cpp
ABIGEN = $(CDT_PREFIX)/bin/eosio-abigen

# Flags
CFLAGS = -abigen -I. -O3

# Output directory
BUILD_DIR = build

# Source files
SOURCES = $(CONTRACT).cpp
HEADERS = $(CONTRACT).hpp

# Output files
WASM = $(BUILD_DIR)/$(CONTRACT).wasm
ABI = $(BUILD_DIR)/$(CONTRACT).abi

.PHONY: all clean

all: $(BUILD_DIR) $(WASM)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(WASM): $(SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) -o $(WASM) $(SOURCES)
	@echo "Contract compiled successfully!"
	@echo "WASM: $(WASM)"
	@echo "ABI:  $(ABI)"

clean:
	rm -rf $(BUILD_DIR)
	@echo "Build directory cleaned."

# Deployment helper (requires cleos to be configured)
deploy:
	@echo "Deploying contract to cheeseamphub account..."
	cleos set contract cheeseamphub $(BUILD_DIR) $(CONTRACT).wasm $(CONTRACT).abi -p cheeseamphub@active
	@echo "Contract deployed!"

# Add eosio.code permission (required for inline actions)
setup-permissions:
	@echo "Adding eosio.code permission..."
	cleos set account permission cheeseamphub active \
		--add-code \
		-p cheeseamphub@owner
	@echo "Permission added!"

# Check tables
check-deposits:
	cleos get table cheeseamphub cheeseamphub deposits

check-playcounts:
	cleos get table cheeseamphub cheeseamphub playcounts

check-config:
	cleos get table cheeseamphub cheeseamphub config

check-playlogs:
	cleos get table cheeseamphub cheeseamphub playlogs

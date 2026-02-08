# Makefile for cheesebannad contract
# Requires EOSIO CDT (Contract Development Toolkit)

CONTRACT = cheesebannad
CDT_PREFIX ?= /usr/local/eosio.cdt
CC = $(CDT_PREFIX)/bin/eosio-cpp
CFLAGS = -abigen -I. -O3
BUILD_DIR = build

SOURCES = $(CONTRACT).cpp
HEADERS = $(CONTRACT).hpp

WASM = $(BUILD_DIR)/$(CONTRACT).wasm
ABI = $(BUILD_DIR)/$(CONTRACT).abi

.PHONY: all clean deploy setup-permissions

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

deploy:
	@echo "Deploying contract to cheesebannad account..."
	cleos set contract cheesebannad $(BUILD_DIR) $(CONTRACT).wasm $(CONTRACT).abi -p cheesebannad@active
	@echo "Contract deployed!"

setup-permissions:
	@echo "Adding eosio.code permission..."
	cleos set account permission cheesebannad active \
		--add-code \
		-p cheesebannad@owner
	@echo "Permission added!"

check-ads:
	cleos get table cheesebannad cheesebannad bannerads

check-config:
	cleos get table cheesebannad cheesebannad config

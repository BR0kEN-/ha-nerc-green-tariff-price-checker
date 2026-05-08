#!/usr/bin/with-contenv bashio

node index.js \
  "$(bashio::config joined)" \
  "$(bashio::config checkInterval)"

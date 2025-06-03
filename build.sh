#!/usr/bin/env bash

# (1) Update package lists
apt-get update

# (2) Install Python, pip, and CA certificates
apt-get install -y python3 python3-pip ca-certificates

# (3) Install snscrape via pip
pip3 install snscrape


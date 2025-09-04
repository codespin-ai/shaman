#!/bin/bash
set -e

# Default values
IMAGE_NAME="shaman"
TAG="latest"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--tag TAG] [--name IMAGE_NAME]"
      exit 1
      ;;
  esac
done

echo "Building Docker image: ${IMAGE_NAME}:${TAG}"

# Build the image
docker build \
  --tag "${IMAGE_NAME}:${TAG}" \
  --file Dockerfile \
  .

echo "Successfully built ${IMAGE_NAME}:${TAG}"

# Show image info
docker images "${IMAGE_NAME}:${TAG}"
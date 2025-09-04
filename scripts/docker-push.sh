#!/bin/bash
set -e

# Default values
IMAGE_NAME="shaman"
TAG="latest"
REGISTRY=""

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
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--tag TAG] [--name IMAGE_NAME] [--registry REGISTRY]"
      echo "Example: $0 --tag v1.0.0 --registry ghcr.io/codespin-ai"
      exit 1
      ;;
  esac
done

# Construct full image name
if [ -n "$REGISTRY" ]; then
  FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}"
else
  FULL_IMAGE="${IMAGE_NAME}"
fi

echo "Pushing Docker image: ${FULL_IMAGE}:${TAG}"

# Tag the image if registry is specified
if [ -n "$REGISTRY" ]; then
  echo "Tagging image for registry..."
  docker tag "${IMAGE_NAME}:${TAG}" "${FULL_IMAGE}:${TAG}"
  
  # Also tag as latest if pushing a versioned tag
  if [ "$TAG" != "latest" ]; then
    docker tag "${IMAGE_NAME}:${TAG}" "${FULL_IMAGE}:latest"
  fi
fi

# Push the image
echo "Pushing ${FULL_IMAGE}:${TAG}..."
docker push "${FULL_IMAGE}:${TAG}"

# Push latest tag if we tagged it
if [ "$TAG" != "latest" ] && [ -n "$REGISTRY" ]; then
  echo "Pushing ${FULL_IMAGE}:latest..."
  docker push "${FULL_IMAGE}:latest"
fi

echo "Successfully pushed ${FULL_IMAGE}:${TAG}"
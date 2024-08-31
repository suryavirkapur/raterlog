# Use the latest Kong image as the base
FROM kong:latest

# Set environment variables
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yml

# Copy the kong.yml file into the container
COPY kong.yml /usr/local/kong/declarative/kong.yml

# Expose the necessary ports
EXPOSE 8000 8443 8001 8444

# The CMD instruction is not needed as it's already defined in the base Kong image
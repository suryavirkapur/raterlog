FROM oven/bun:1
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]

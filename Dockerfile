FROM denoland/deno:2.9.7

WORKDIR /app

# Cache the database driver before copying application code.
COPY deno.json ./
RUN deno cache npm:postgres@3.4.7

COPY src/ ./src/
COPY scripts/ ./scripts/
COPY db/ ./db/
RUN deno cache src/main.ts scripts/migrate.ts

USER deno
EXPOSE 8000
CMD ["deno", "task", "start"]

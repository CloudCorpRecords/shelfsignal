FROM node:20-alpine
LABEL io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/shelfsignal"
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npm run build || true
CMD ["node", "dist/cli.js", "mcp"]

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Pass a default backend URL for build if necessary, though rewrites run at runtime
ENV BACKEND_URL=http://backend:8000

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
